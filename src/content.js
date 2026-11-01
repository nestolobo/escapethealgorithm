/**
 * Content Script for "Escape the Algorithm"
 *
 * This script is injected into supported social media websites and works to hide distracting feeds
 * and content by targeting site-specific DOM elements. It uses a configuration object ("sites") that
 * defines selectors and actions for each supported site (e.g., YouTube, Twitter, Facebook, etc.).
 *
 * The script performs the following key tasks:
 *   - Determines the current site based on the URL.
 *   - Retrieves user settings from storage to determine if content blocking is enabled.
 *   - Hides or shows content by applying CSS classes or inline styles to feed elements.
 *   - Injects toggle buttons into the page to allow users to show/hide hidden content.
 *   - Monitors page mutations (for dynamic content) and periodically checks for new elements.
 *   - Handles special cases (e.g., YouTube Shorts, Twitter tweet composition areas) and performs additional actions
 *     such as pausing videos or disabling autoplay.
 *
 * This approach allows users to customize their browsing experience by reducing exposure to algorithmically driven content.
 *
 * Licensed under MIT. See LICENSE for details.
 */

import browser from "webextension-polyfill";

let isContentHidden = true;
let siteEnabled = true;
let hardcoreMode = false;
let countdownInterval = null;
let revealSeconds = 600; // How long revealed content stays visible, from the "revealMinutes" setting
let countdownSeconds = revealSeconds;
let revealsPerDay = 0; // Max reveals per day across all sites; 0 means unlimited
let twitterDailyLimitMinutes = 0; // Daily time budget for X; 0 means no limit

const USAGE_TICK_SECONDS = 5;
const LIMIT_SETTING_KEYS = ["revealMinutes", "revealsPerDay", "twitterDailyLimit"];

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function applyLimitSettings(result) {
  // Older installs have no limit settings saved, so fall back to the
  // original 10 minute reveal window and no daily caps.
  const revealMinutes = Number(result.revealMinutes) || 10;
  revealSeconds = revealMinutes * 60;
  if (!countdownInterval) countdownSeconds = revealSeconds;
  revealsPerDay = Number(result.revealsPerDay) || 0;
  twitterDailyLimitMinutes = Number(result.twitterDailyLimit) || 0;
}

function showBody() {
  document.body.style.display = "";
}

function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function updateCountdownDisplay() {
  const el = document.querySelector(".algorithm-escape-countdown");
  if (el) {
    el.textContent = formatCountdown(countdownSeconds);
  }
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownSeconds = revealSeconds;
  updateCountdownDisplay();
  countdownInterval = setInterval(() => {
    countdownSeconds--;
    updateCountdownDisplay();
    if (countdownSeconds <= 0) {
      isContentHidden = true;
      const currentSite = getCurrentSite();
      hideOrShowContent(currentSite === "youtube" ? "main-feed" : currentSite);
      const button = document.querySelector(".algorithm-escape-toggle");
      updateToggleButton(button);
      stopCountdown();
    }
  }, 1000);
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  countdownSeconds = revealSeconds;
  updateCountdownDisplay();
}

//This code defines a configuration object called sites that specifies how to handle content blocking for different social media platforms.
// The selectors and functions are used in conjunction with DOM manipulation to hide distracting content while preserving the core functionality of each platform.

const sites = {
  youtube: {
// Defines selectors for different types of content (main feed, end screens, shorts, sidebar)
// Disables autoplay functionality
// Allows certain pages to show content (videos, subscription feeds, and playlists)
// Detects if user is on a Shorts page
    selectorGroups: [
      {
        name: "main-feed",
        selector: "div#contents.style-scope.ytd-rich-grid-renderer",
      },
      {
        name: "end-screen",
        selector: ".ytp-endscreen-content, .ytp-ce-element",
      },
      {
        name: "shorts-feed",
        selector: "#page-manager > ytd-shorts",
      },
      {
        name: "sidebar-content",
        selector: "#related",
      },
    ],
    channelVideosSelector: "#contents.ytd-rich-grid-renderer",
    additionalActions: function () {
      this.disableAutoplay();
    },

    disableAutoplay: function () {
      const autoplayToggle = document.querySelector(
        ".ytp-autonav-toggle-button"
      );
      if (
        autoplayToggle &&
        autoplayToggle.getAttribute("aria-checked") === "true"
      ) {
        autoplayToggle.click();
      }

      if (window.yt && window.yt.player && window.yt.player.getPlayer) {
        const player = window.yt.player.getPlayer();
        if (player && player.pauseVideo) {
          const originalPauseVideo = player.pauseVideo;
          player.pauseVideo = function () {
            originalPauseVideo.apply(this, arguments);
            if (this.cancelPlayback) {
              this.cancelPlayback();
            }
          };
        }
      }
    },
    isAllowedPage: function () {
      const path = window.location.pathname;
      return (
        path.includes("/videos") ||
        path.includes("/feed/subscriptions") ||
        // Your playlists ("/feed/playlists"), a single playlist ("/playlist?list=..."),
        // and a channel's playlists tab ("/@channel/playlists")
        path.includes("/playlist") ||
        // The "You" page that links to your playlists, Watch later, and Liked videos
        path.startsWith("/feed/you") ||
        path.startsWith("/feed/library")
      );
    },
    isShortsPage: function () {
      return window.location.pathname.includes("/shorts");
    },
  },
  twitter: {
    // Targets main feed and sidebar content
    // Preserves tweet composition box and search functionality
    // Allows certain pages to show content -- notifications, messages, bookmarks, profiles, single tweets
    // Provides helper functions to identify different page types

    selectors: [
      {
        name: "main-feed",
        selector: '[data-testid="primaryColumn"] [data-testid="cellInnerDiv"]',
      },
      {
        name: "sidebar-content",
        selector: '[data-testid="sidebarColumn"] > div > div:not(:first-child)',
      },
    ],
    tweetBoxSelector: '[data-testid="tweetTextarea_0"]',
    searchBoxSelector: '[data-testid="SearchBox_Search_Input"]',
    isAllowedPage: function () {
      return (
        this.isNotificationsPage() ||
        this.isMessagesPage() ||
        this.isBookmarksPage() ||
        this.isProfilePage() ||
        this.isSingleTweetPage() ||
        this.isTimelinePage()
      );
    },
    isNotificationsPage: function () {
      return window.location.pathname.includes("/notifications");
    },
    isMessagesPage: function () {
      return window.location.pathname.includes("/messages");
    },
    isBookmarksPage: function () {
      // All bookmarks ("/i/bookmarks") or a bookmark folder ("/i/bookmarks/123")
      return window.location.pathname.startsWith("/i/bookmarks");
    },
    isProfilePage: function () {
      // A profile ("/username") or one of its tabs ("/username/media", etc.)
      return (
        /^\/[^\/]+(\/(media|with_replies|likes|highlights|articles|superfollows|followers|following|verified_followers|followers_you_follow))?$/.test(
          window.location.pathname
        ) &&
        !window.location.pathname.includes("/home") &&
        // Explore is a single path segment like a username, but it's an algorithmic feed
        !/^\/explore\/?$/.test(window.location.pathname)
      );
    },
    isSingleTweetPage: function () {
      return window.location.pathname.includes("/status/");
    },
    isTimelinePage: function () {
      return window.location.pathname.includes("/i/timeline");
    },
    getTweetBox: function () {
      return document.querySelector(this.tweetBoxSelector);
    },
    getTweetBoxContainer: function () {
      const tweetBox = document.querySelector(this.tweetBoxSelector);
      return tweetBox
        ? tweetBox.closest('[data-testid="primaryColumn"] > div > div')
        : null;
    },
  },
  facebook: {
    // Has a function to identify and target the news feed
    // Uses complex DOM traversal to find feed content due to Facebook's dynamic structure
    // Hides the whole main area on the Reels feed, which has no [role="article"] posts
    reelsSelector: 'div[role="main"]',
    isReelsPage: function () {
      // The Reels tab ("/reel/?s=tab"), a single reel ("/reel/123"), or "/reels/..."
      return /^\/reels?(\/|$)/.test(window.location.pathname);
    },
    getNewsfeed: function () {
      const mainContent = document.querySelector('div[role="main"]');
      if (!mainContent) return null;

      const possibleFeeds = mainContent.querySelectorAll(
        "div > div > div > div > div > div > div > div"
      );
      for (let feed of possibleFeeds) {
        if (feed.querySelector('[role="article"]')) {
          return feed;
        }
      }
      return null;
    },
  },
  instagram: {
    // Targets the main content area on algorithmic pages (home "For you" feed, Explore, Reels)
    // and inside saved folders
    // Allows profiles, single posts, stories, messages, settings, the saved folder list, and
    // Instagram's native chronological "Following" / "Favorites" feeds (/?variant=following, /?variant=favorites)
    selectors: ['main[role="main"] > div > div'],
    followingFeedUrl: "/?variant=following",
    isAllowedPage: function () {
      const path = window.location.pathname;
      if (path === "/" || path === "") {
        const variant = new URLSearchParams(window.location.search).get(
          "variant"
        );
        return variant === "following" || variant === "favorites";
      }
      return (
        !path.startsWith("/explore") &&
        !path.startsWith("/reels") &&
        !this.isSavedFolderPage()
      );
    },
    isSavedFolderPage: function () {
      // A saved folder ("/username/saved/all-posts/" or
      // "/username/saved/folder-name/123/"), but not the folder list at "/username/saved/"
      return /^\/[^\/]+\/saved\/[^\/]+/.test(window.location.pathname);
    },
  },
  tiktok: {
    // Targets main feed, explore feed, and live feed content
    // Blocks all pages by default (most restrictive) 
    selectorGroups: [
      {
        name: "main-feed",
        selector: "#main-content-homepage_hot",
      },
      {
        name: "explore-feed",
        selector: "#main-content-explore_page",
      },
      {
        name: "live-feed",
        selector: "#tiktok-live-main-container-id",
      },
    ],
    isAllowedPage: function () {
      return false; // Block all pages by default
    },
  },
  pinterest: {
    selectorGroups: [
      {
        name: "main-feed",
        selector:
          '[data-test-id="homefeed"], [data-test-id="pinGrid"], div[role="main"] > div > div > div',
      },
      {
        name: "explore-feed",
        selector: '[data-test-id="search-guide-feed"]',
      },
    ],
    isAllowedPage: function () {
      const path = window.location.pathname;
      return (
        path.startsWith("/pin/") ||
        path.startsWith("/search/") ||
        path.startsWith("/settings/") ||
        (path !== "/" &&
          path !== "" &&
          !path.startsWith("/ideas/") &&
          !path.startsWith("/today"))
      );
    },
  },
  linkedin: {
    selectorGroups: [
      {
        name: "main-feed",
        // LinkedIn's current layout uses generated class names; the
        // data-testid is the stable hook. The rest cover the older layout.
        selector:
          '[data-testid="mainFeed"], .scaffold-finite-scroll__content, .scaffold-layout__main .feed-shared-update-v2, .scaffold-layout__main',
      },
    ],
    isAllowedPage: function () {
      const path = window.location.pathname;
      return (
        path.startsWith("/notifications") ||
        path.startsWith("/messaging") ||
        path.startsWith("/in/") ||
        path.startsWith("/jobs") ||
        path.startsWith("/mynetwork") ||
        path.startsWith("/settings") ||
        path.startsWith("/company/")
      );
    },
  },
  reddit: {
    // Targets the post feed and its "popular communities" sidebar on algorithmic pages:
    // the home feed and its sorts, r/popular, r/all, Explore, and News.
    // Allows subreddits you chose to visit, posts, profiles, search, messages, and settings.
    // Covers the current site (shreddit-feed) and old.reddit.com (#siteTable).
    selectors: [
      "main#main-content",
      "shreddit-feed",
      "#right-sidebar-container",
      "#siteTable",
    ],
    isAllowedPage: function () {
      const path =
        window.location.pathname.toLowerCase().replace(/\/+$/, "") || "/";
      return !(
        /^\/(best|hot|new|top|rising)?$/.test(path) ||
        /^\/r\/(popular|all)(\/|$)/.test(path) ||
        /^\/(explore|news)(\/|$)/.test(path)
      );
    },
  },
};

function getCurrentSite() {
/**
 * Determines which supported social media site the user is currently on
 * by checking the hostname of the current URL.
 * 
 * returns the identifier for the current site ('youtube', 'facebook', etc.) or null if the site is not supported
 */

  const hostname = window.location.hostname;

  if (hostname === "youtube.com" || hostname === "www.youtube.com") {
    return "youtube";
  }
  if (hostname === "facebook.com" || hostname === "www.facebook.com") {
    return "facebook";
  }
  if (hostname === "instagram.com" || hostname === "www.instagram.com") {
    return "instagram";
  }
  if (
    hostname === "twitter.com" ||
    hostname === "www.twitter.com" ||
    hostname === "x.com" ||
    hostname === "www.x.com"
  ) {
    return "twitter";
  }
  if (hostname === "tiktok.com" || hostname === "www.tiktok.com") {
    return "tiktok";
  }
  if (
    hostname === "pinterest.com" ||
    hostname === "www.pinterest.com" ||
    hostname.endsWith(".pinterest.com")
  ) {
    return "pinterest";
  }
  if (hostname === "linkedin.com" || hostname === "www.linkedin.com") {
    return "linkedin";
  }
  if (hostname === "reddit.com" || hostname.endsWith(".reddit.com")) {
    return "reddit";
  }
  return null;
}

function checkSiteEnabled() {
  /**
   * Checks if the current site is enabled in the extension's popup
   * and updates the siteEnabled variable accordingly.
   * Also checks if hardcore mode is enabled.
   * If the site is not enabled, it shows all content and updates the toggle button.
   */

  const currentSite = getCurrentSite();
  if (currentSite) {
    const storage = chrome.storage || browser.storage;
    storage.sync
      .get([currentSite, "hardcore", ...LIMIT_SETTING_KEYS])
      .then((result) => {
        siteEnabled = result[currentSite] !== false;
        hardcoreMode = result.hardcore === true;
        applyLimitSettings(result);
        showBody(); // Always show the body
        if (!siteEnabled) {
          showAllContent();
          stopCountdown();
        } else {
          initializeSite();
        }
      })
      .catch((error) => {
        console.error("Error accessing storage:", error);
        showBody(); // Always show the body
        siteEnabled = true;
        hardcoreMode = false;
        initializeSite();
      });
  } else {
    showBody(); // Always show the body for unrecognized sites
  }
}

function initializeSite() {
  // This function is the main initialization logic for the extension, handling content hiding for each supported social media platform. Each platform section has specific logic for:
  // Identifying content to hide
  // Creating toggle buttons
  // Preserving essential functionality (like compose/search)
  // Handling dynamic content loading
  // Managing platform-specific features (like video autoplay)
  if (!siteEnabled) return;

  const currentSite = getCurrentSite();
    // YOUTUBE HANDLING
  if (currentSite === "youtube") {
    if (sites.youtube.isShortsPage()) {
      hideYoutubeShorts();
    } else if (!sites.youtube.isAllowedPage()) {
      sites.youtube.selectorGroups.forEach((group) => {
        // YouTube's SPA keeps previously visited pages cached in the DOM with
        // a [hidden] ancestor (e.g. the subscriptions grid while watching a
        // video). Skip those so allowed pages aren't blanked on back-navigation.
        const elements = Array.from(
          document.querySelectorAll(group.selector)
        ).filter((element) => !element.closest("[hidden]"));
        if (elements.length > 0) {
          elements.forEach((element) => {
            if (group.name === "shorts-feed") {
              element.style.display = isContentHidden ? "none" : "";
            } else {
              element.classList.toggle("hidden-by-extension", isContentHidden);
            }
          });
          createToggleButton(elements[0], group.name);
        }
      });
      sites.youtube.additionalActions();
    } else {
      showYoutubeAllowedFeed();
    }
    // Always try to hide Shorts shelf
    const shortsShelf = document.querySelector("ytd-reel-shelf-renderer");
    if (shortsShelf) {
      shortsShelf.style.display = isContentHidden ? "none" : "";
    }

    const sidebarContent = document.querySelector("#related");
    if (sidebarContent) {
      sidebarContent.style.display = isContentHidden ? "none" : "";
      if (
        !document.querySelector(
          '.algorithm-escape-toggle-container[data-group="sidebar-content"]'
        )
      ) {
        createToggleButton(sidebarContent, "sidebar-content");
      }
    }
  } else if (currentSite === "facebook") {
    if (sites.facebook.isReelsPage()) {
      hideFacebookReels();
      return;
    }
    // Facebook is an SPA, so un-hide the main area after navigating away from Reels
    showFacebookReelsAllowedPage();

    const newsfeed = sites.facebook.getNewsfeed();
    if (newsfeed && !newsfeed.classList.contains("hidden-by-extension")) {
      newsfeed.classList.add("hidden-by-extension");
      createToggleButton(newsfeed, "facebook-feed");
    }
    // Add an observer for Facebook to handle dynamic content loading
    const facebookObserver = new MutationObserver(() => {
      const newsfeed = sites.facebook.getNewsfeed();
      if (
        newsfeed &&
        !newsfeed.classList.contains("hidden-by-extension") &&
        !document.querySelector(
          '.algorithm-escape-toggle-container[data-group="facebook-feed"]'
        )
      ) {
        newsfeed.classList.add("hidden-by-extension");
        createToggleButton(newsfeed, "facebook-feed");
      }
    });
    facebookObserver.observe(document.body, { childList: true, subtree: true });
  } else if (currentSite === "instagram") {
    if (sites.instagram.isAllowedPage()) {
      showInstagramAllowedPage();
      return;
    }

    let contentFound = false;
    sites.instagram.selectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        contentFound = true;
        elements.forEach((element) => {
          if (!element.classList.contains("hidden-by-extension")) {
            element.classList.add("hidden-by-extension");
          }
        });
      }
    });
    if (
      contentFound &&
      !document.querySelector(
        '.algorithm-escape-toggle-container[data-group="instagram"]'
      )
    ) {
      createToggleButton(document.body, "instagram", true);
    }
  } else if (currentSite === "twitter") {
    console.log("Initializing Twitter");
    debugTwitterPageType();

    if (sites.twitter.isAllowedPage()) {
      console.log("On an allowed Twitter page, not hiding content");
      showTwitterAllowedPage();
      return;
    }

    let contentFound = false;
    sites.twitter.selectors.forEach(({ name, selector }) => {
      const elements = document.querySelectorAll(selector);
      console.log(`Found ${elements.length} elements for ${name}`);
      if (elements.length > 0) {
        contentFound = true;
        elements.forEach((element) => {
          if (
            !element.closest(sites.twitter.tweetBoxSelector) &&
            !element.closest(sites.twitter.searchBoxSelector)
          ) {
            element.style.display = isContentHidden ? "none" : "";
            console.log(`Set display to ${element.style.display} for ${name}`);
          }
        });
      }
    });

    // Ensure tweet composition area and search bar are always visible
    const tweetBox = document.querySelector(sites.twitter.tweetBoxSelector);
    if (tweetBox) {
      const tweetBoxContainer = tweetBox.closest(
        '[data-testid="primaryColumn"] > div > div'
      );
      if (tweetBoxContainer) {
        tweetBoxContainer.style.display = "";
      }
    }

    const searchBox = document.querySelector(sites.twitter.searchBoxSelector);
    if (searchBox) {
      const searchBoxContainer = searchBox.closest('[role="search"]');
      if (searchBoxContainer) {
        searchBoxContainer.style.display = "";
      }
    }

    if (
      contentFound &&
      !document.querySelector(
        '.algorithm-escape-toggle-container[data-group="twitter"]'
      )
    ) {
      console.log("Creating toggle button for Twitter");
      createToggleButton(document.body, "twitter", true);
    }
  } else if (currentSite === "tiktok") {
    console.log("Initializing TikTok"); // Debug log
    let contentFound = false;

    if (!sites.tiktok.isAllowedPage()) {
      sites.tiktok.selectorGroups.forEach((group) => {
        const elements = document.querySelectorAll(group.selector);
        console.log(
          `Found ${elements.length} elements for selector: ${group.selector}`
        ); // Debug log
        if (elements.length > 0) {
          contentFound = true;
          elements.forEach((element) => {
            element.style.display = "none";
            console.log("Element hidden:", element); // Debug log
          });
        }
      });

      if (
        contentFound &&
        !document.querySelector(
          '.algorithm-escape-toggle-container[data-group="tiktok"]'
        )
      ) {
        console.log("Creating toggle button for TikTok"); // Debug log
        createToggleButton(document.body, "tiktok", true);
      }

      pauseAllVideos();
    }
  } else if (currentSite === "pinterest") {
    if (!sites.pinterest.isAllowedPage()) {
      let contentFound = false;

      sites.pinterest.selectorGroups.forEach((group) => {
        const elements = document.querySelectorAll(group.selector);
        if (elements.length > 0) {
          contentFound = true;
          elements.forEach((element) => {
            element.style.display = isContentHidden ? "none" : "";
          });
        }
      });

      if (
        contentFound &&
        !document.querySelector(
          '.algorithm-escape-toggle-container[data-group="pinterest"]'
        )
      ) {
        createToggleButton(document.body, "pinterest", true);
      }
    }
  } else if (currentSite === "linkedin") {
    if (!sites.linkedin.isAllowedPage()) {
      let contentFound = false;

      sites.linkedin.selectorGroups.forEach((group) => {
        const elements = document.querySelectorAll(group.selector);
        if (elements.length > 0) {
          contentFound = true;
          elements.forEach((element) => {
            element.style.display = isContentHidden ? "none" : "";
          });
        }
      });

      if (
        contentFound &&
        !document.querySelector(
          '.algorithm-escape-toggle-container[data-group="linkedin"]'
        )
      ) {
        createToggleButton(document.body, "linkedin", true);
      }
    }
  } else if (currentSite === "reddit") {
    if (sites.reddit.isAllowedPage()) {
      showRedditAllowedPage();
      return;
    }

    let contentFound = false;
    sites.reddit.selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        contentFound = true;
        element.classList.toggle("hidden-by-extension", isContentHidden);
      });
    });
    if (contentFound) {
      createToggleButton(document.body, "reddit", true);
    }
  }
}

function showYoutubeAllowedFeed() {
  // Allowed pages (subscriptions, channel videos) can arrive with the feed
  // grid still hidden: while browsing another page, the SPA-cached grid may
  // have been hidden by the extension. Undo that here.
  const group = sites.youtube.selectorGroups.find(
    (g) => g.name === "main-feed"
  );
  document.querySelectorAll(group.selector).forEach((element) => {
    element.classList.remove("hidden-by-extension");
    if (element.style.display === "none") {
      element.style.display = "";
    }
  });
  document
    .querySelectorAll(
      '.algorithm-escape-toggle-container[data-group="main-feed"]'
    )
    .forEach((container) => container.remove());
}

function hideFacebookReels() {
  const elements = document.querySelectorAll(sites.facebook.reelsSelector);
  elements.forEach((element) => {
    element.classList.toggle("hidden-by-extension", isContentHidden);
  });
  // Hidden videos keep playing sound, so pause every reel on the page too
  document.querySelectorAll("video").forEach((video) => {
    if (isContentHidden) {
      video.pause();
      video.muted = true;
    } else {
      video.muted = false;
    }
  });
  if (elements.length > 0) {
    createToggleButton(document.body, "facebook-reels", true);
  }
}

function showFacebookReelsAllowedPage() {
  document
    .querySelectorAll(`${sites.facebook.reelsSelector}.hidden-by-extension`)
    .forEach((element) => element.classList.remove("hidden-by-extension"));
  document
    .querySelectorAll(
      '.algorithm-escape-toggle-container[data-group="facebook-reels"]'
    )
    .forEach((container) => container.remove());
}

function showRedditAllowedPage() {
  // Reddit navigates without full page loads, so content hidden on a blocked
  // page (e.g. the home feed) can still be hidden after moving to a subreddit
  sites.reddit.selectors.forEach((selector) => {
    document
      .querySelectorAll(`${selector}.hidden-by-extension`)
      .forEach((element) => element.classList.remove("hidden-by-extension"));
  });
  document
    .querySelectorAll('.algorithm-escape-toggle-container[data-group="reddit"]')
    .forEach((container) => container.remove());
}

function showTwitterAllowedPage() {
  // X navigates without full page loads, so posts hidden on Home can still be
  // hidden after moving to an allowed page such as Bookmarks or a profile
  const mainFeed = sites.twitter.selectors.find((s) => s.name === "main-feed");
  document.querySelectorAll(mainFeed.selector).forEach((element) => {
    if (element.style.display === "none") {
      element.style.display = "";
    }
  });
  document
    .querySelectorAll('.algorithm-escape-toggle-container[data-group="twitter"]')
    .forEach((container) => container.remove());
}

function showInstagramAllowedPage() {
  // Instagram is an SPA, so content hidden on a blocked page (e.g. the home
  // feed) can still carry the hidden class after navigating to an allowed page
  // like a profile. Undo that and drop the toggle button here.
  sites.instagram.selectors.forEach((selector) => {
    document
      .querySelectorAll(`${selector}.hidden-by-extension`)
      .forEach((element) => element.classList.remove("hidden-by-extension"));
  });
  document
    .querySelectorAll(
      '.algorithm-escape-toggle-container[data-group="instagram"]'
    )
    .forEach((container) => container.remove());
}

function showAllContent() {

  const currentSite = getCurrentSite();
  if (currentSite === "youtube") {
    sites.youtube.selectorGroups.forEach((group) => {
      const elements = document.querySelectorAll(group.selector);
      elements.forEach((element) => {
        element.classList.remove("hidden-by-extension");
        element.style.display = "";
      });
    });
    const sidebarContent = document.querySelector("#related");
    if (sidebarContent) {
      sidebarContent.classList.remove("hidden-by-extension");
      sidebarContent.style.display = "";
    }
  } else if (currentSite === "facebook") {
    const newsfeed = sites.facebook.getNewsfeed();
    if (newsfeed) {
      newsfeed.classList.remove("hidden-by-extension");
    }
    showFacebookReelsAllowedPage();
  } else if (currentSite === "instagram") {
    sites.instagram.selectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        element.classList.remove("hidden-by-extension");
      });
    });
  } else if (currentSite === "twitter") {
    sites.twitter.selectors.forEach(({ selector }) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        element.style.display = "";
      });
    });
  } else if (currentSite === "tiktok") {
    sites.tiktok.selectors.forEach(({ selector }) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        element.classList.remove("hidden-by-extension");
      });
    });
  } else if (currentSite === "pinterest") {
    sites.pinterest.selectorGroups.forEach((group) => {
      const elements = document.querySelectorAll(group.selector);
      elements.forEach((element) => {
        element.style.display = "";
      });
    });
  } else if (currentSite === "linkedin") {
    sites.linkedin.selectorGroups.forEach((group) => {
      const elements = document.querySelectorAll(group.selector);
      elements.forEach((element) => {
        element.style.display = "";
      });
    });
  } else if (currentSite === "reddit") {
    showRedditAllowedPage();
  }

  const buttons = document.querySelectorAll(
    ".algorithm-escape-toggle-container"
  );
  buttons.forEach((button) => button.remove());
}

function createToggleButton(element, groupName, fixed = false) {
  // In hardcore mode, don't create any toggle buttons
  if (hardcoreMode) return null;

  let container = document.querySelector(
    `.algorithm-escape-toggle-container[data-group="${groupName}"]`
  );
  if (container) return container.querySelector(".algorithm-escape-toggle");

  container = document.createElement("div");
  container.className = "algorithm-escape-toggle-container";
  container.setAttribute("data-group", groupName);

  const isDarkMode =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const bgColor = isDarkMode
    ? "rgba(26, 26, 46, 0.9)"
    : "rgba(255, 255, 255, 0.9)";
  const textColor = isDarkMode ? "#e0e0e0" : "#333333";
  const buttonTextColor = "#e94560";

  if (fixed) {
    Object.assign(container.style, {
      position: "fixed",
      top: "60px",
      left: "50%",
      transform: "translateX(-50%)",
      opacity: "0",
      zIndex: "9999999",
      backgroundColor: bgColor,
      padding: "15px",
      borderRadius: "10px",
      boxShadow: "0 4px 20px rgba(233, 69, 96, 0.2)",
      transition: "opacity 0.5s ease-out",
      overflow: "hidden",
    });
  } else {
    Object.assign(container.style, {
      position: "sticky",
      top: "0",
      zIndex: "9999",
      backgroundColor: bgColor,
      padding: "15px",
      textAlign: "center",
      opacity: "0",
      transition: "opacity 0.5s ease-out",
      overflow: "hidden",
    });
  }

  const button = document.createElement("button");
  button.className = "algorithm-escape-toggle";
  button.textContent = "Show Hidden Content";
  Object.assign(button.style, {
    backgroundColor: "transparent",
    color: buttonTextColor,
    border: "2px solid #e94560",
    padding: "10px 15px",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "bold",
    transition: "transform 0.3s ease",
  });

  const text = document.createElement("p");
  text.className = "algorithm-escape-text";
  text.textContent = "You are escaping the algorithm 😎";
  Object.assign(text.style, {
    color: textColor,
    margin: "10px 0 0",
    fontSize: "12px",
  });

  // Create close button
  const closeButton = document.createElement("div");
  closeButton.className = "algorithm-escape-close";
  Object.assign(closeButton.style, {
    position: "absolute",
    top: "1px",
    right: "1px",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    backgroundColor: "rgba(128, 128, 128, 0.5)",
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "14px",
    color: "white",
    fontWeight: "bold",
  });
  closeButton.textContent = "×";

  closeButton.addEventListener("click", (e) => {
    e.stopPropagation();
    container.style.display = "none";
  });

  const countdown = document.createElement("p");
  countdown.className = "algorithm-escape-countdown";
  countdown.textContent = formatCountdown(countdownSeconds);
  Object.assign(countdown.style, {
    color: textColor,
    margin: "5px 0 0",
    fontSize: "11px",
    display: isContentHidden ? "none" : "",
  });

  container.appendChild(closeButton);
  container.appendChild(button);
  container.appendChild(text);
  container.appendChild(countdown);

  const currentSite = getCurrentSite();

  // Point Instagram users at the native chronological feed of accounts they follow
  if (currentSite === "instagram") {
    const followingLink = document.createElement("a");
    followingLink.className = "algorithm-escape-following-link";
    followingLink.href = sites.instagram.followingFeedUrl;
    followingLink.textContent = "Go to Following feed →";
    Object.assign(followingLink.style, {
      display: "block",
      color: buttonTextColor,
      margin: "10px 0 0",
      fontSize: "12px",
      fontWeight: "bold",
      textAlign: "center",
      textDecoration: "none",
    });
    container.appendChild(followingLink);
  }

  if (currentSite === "twitter") {
    const tweetBox = sites.twitter.getTweetBox();
    const tweetBoxContainer = tweetBox
      ? tweetBox.closest('[data-testid="primaryColumn"] > div > div')
      : null;
    if (tweetBoxContainer) {
      tweetBoxContainer.parentNode.insertBefore(
        container,
        tweetBoxContainer.nextSibling
      );
    } else {
      // Pages without a compose box would otherwise never get a toggle button
      document.body.appendChild(container);
    }
  } else if (currentSite === "instagram" || currentSite === "tiktok" || currentSite === "pinterest" || currentSite === "linkedin" || currentSite === "reddit") {
    document.body.appendChild(container);
  } else if (element) {
    element.parentNode.insertBefore(container, element);
  } else {
    document.body.appendChild(container);
  }

  button.addEventListener("click", () => toggleContent(groupName));

  // Trigger fade-in after a short delay
  setTimeout(() => {
    container.style.opacity = "1";
  }, 100);

  // Add subtle scale effect to the button
  button.addEventListener("mouseover", () => {
    button.style.transform = "scale(1.05)";
  });

  button.addEventListener("mouseout", () => {
    button.style.transform = "scale(1)";
  });

  return button;
}

async function toggleContent(groupName) {
  if (!isContentHidden) {
    // If content is already shown, hide it without confirmation
    isContentHidden = true;
    hideOrShowContent(groupName);
    stopCountdown();
  } else {
    // If content is hidden, show confirmation modal unless today's reveals are used up
    const revealUsage = await getTodayUsage("revealUsage", { count: 0 });
    if (revealsPerDay > 0 && revealUsage.count >= revealsPerDay) {
      await createModal({
        message: "You've used all your reveals for today. Come back tomorrow 😎",
        confirmText: null,
        cancelText: "OK",
      });
      return;
    }
    const revealsLeft = revealsPerDay - revealUsage.count;
    const shouldShow = await createModal(
      revealsPerDay > 0
        ? {
            message: `Are you sure you actually want to show this content? You have ${revealsLeft} reveal${revealsLeft === 1 ? "" : "s"} left today.`,
          }
        : {}
    );
    if (shouldShow) {
      revealUsage.count++;
      await storage.local.set({ revealUsage });
      isContentHidden = false;
      hideOrShowContent(groupName);
      startCountdown();
    }
  }
  const currentSite = getCurrentSite();
  if (currentSite === "twitter") {
    const button = document.querySelector(
      '.algorithm-escape-toggle-container[data-group="twitter"] .algorithm-escape-toggle'
    );
    updateToggleButton(button);
  } else {
    const button = document.querySelector(
      `.algorithm-escape-toggle-container[data-group="${groupName}"] .algorithm-escape-toggle`
    );
    updateToggleButton(button);
  }
}

function updateToggleButton(button) {
  if (button) {
    const text = button.nextElementSibling;
    button.textContent = isContentHidden
      ? "Show Hidden Content"
      : "Hide Content";
    text.textContent = isContentHidden
      ? "You are escaping the algorithm 😎"
      : "Don't get sucked in 😱";
    const countdown = button
      .closest(".algorithm-escape-toggle-container")
      ?.querySelector(".algorithm-escape-countdown");
    if (countdown) {
      countdown.style.display = isContentHidden ? "none" : "";
    }
  }
}

function createModal({
  message = "Are you sure you actually want to show this content?",
  confirmText = "Yes, I'm sure",
  cancelText = "Honestly, no",
} = {}) {
  const modal = document.createElement("div");
  modal.className = "algorithm-escape-modal";

  const isDarkMode =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const bgColor = isDarkMode
    ? "rgba(26, 26, 46, 0.9)"
    : "rgba(255, 255, 255, 0.9)";
  const textColor = isDarkMode ? "#e0e0e0" : "#333333";
  const buttonTextColor = "#e94560";

  modal.innerHTML = `
        <div class="algorithm-escape-modal-content">
            <h2>${message}</h2>
            ${confirmText ? `<button id="confirmShow" class="algorithm-escape-modal-button">${confirmText}</button>` : ""}
            <button id="cancelShow" class="algorithm-escape-modal-button">${cancelText}</button>
        </div>
    `;
  document.body.appendChild(modal);

  const modalStyle = document.createElement("style");
  modalStyle.textContent = `
        .algorithm-escape-modal {
            position: fixed;
            z-index: 10000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .algorithm-escape-modal-content {
            background-color: ${bgColor};
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(233, 69, 96, 0.2);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol" !important;
        }
        .algorithm-escape-modal-content h2 {
            color: ${textColor};
            font-size: 18px;
            margin-bottom: 20px;
            font-weight: bold;
            font-family: inherit !important;
        }
        .algorithm-escape-modal-button {
            background-color: transparent;
            color: ${buttonTextColor};
            border: 2px solid ${buttonTextColor};
            padding: 10px 15px;
            margin: 0 10px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.3s ease;
            font-family: inherit !important;
        }
        .algorithm-escape-modal-button:hover {
            background-color: ${buttonTextColor};
            color: ${bgColor};
        }
    `;
  document.head.appendChild(modalStyle);

  return new Promise((resolve) => {
    document.getElementById("confirmShow")?.addEventListener("click", () => {
      modal.remove();
      modalStyle.remove();
      resolve(true);
    });
    document.getElementById("cancelShow").addEventListener("click", () => {
      modal.remove();
      modalStyle.remove();
      resolve(false);
    });
  });
}

function hideOrShowContent(groupName) {
  const currentSite = getCurrentSite();
  if (currentSite === "youtube") {
    if (sites.youtube.isAllowedPage()) {
      return;
    }
    if (groupName === "shorts-feed") {
      hideYoutubeShorts();
    } else if (groupName === "sidebar-content") {
      const sidebarContent = document.querySelector("#related");
      if (sidebarContent) {
        if (isContentHidden) {
          sidebarContent.classList.add("hidden-by-extension");
          sidebarContent.style.display = "none";
        } else {
          sidebarContent.classList.remove("hidden-by-extension");
          sidebarContent.style.display = "";
        }
      }
    } else {
      const group = sites.youtube.selectorGroups.find(
        (g) => g.name === groupName
      );
      if (group) {
        // Skip elements inside SPA-cached hidden pages (see initializeSite).
        const elements = Array.from(
          document.querySelectorAll(group.selector)
        ).filter((element) => !element.closest("[hidden]"));
        elements.forEach((element) => {
          element.classList.toggle("hidden-by-extension", isContentHidden);
          element.style.display = isContentHidden ? "none" : "";
        });
      }
    }
    const button = document.querySelector(
      `.algorithm-escape-toggle-container[data-group="${groupName}"] .algorithm-escape-toggle`
    );
    updateToggleButton(button);

    if (isContentHidden) {
      sites.youtube.additionalActions();
    }
  } else if (currentSite === "facebook") {
    if (sites.facebook.isReelsPage()) {
      hideFacebookReels();
      const button = document.querySelector(
        '.algorithm-escape-toggle-container[data-group="facebook-reels"] .algorithm-escape-toggle'
      );
      updateToggleButton(button);
      return;
    }
    const newsfeed = sites.facebook.getNewsfeed();
    if (newsfeed) {
      newsfeed.classList.toggle("hidden-by-extension", isContentHidden);
      const button = newsfeed.previousElementSibling.querySelector(
        ".algorithm-escape-toggle"
      );
      updateToggleButton(button);
    }
  } else if (currentSite === "instagram") {
    if (!sites.instagram.isAllowedPage()) {
      sites.instagram.selectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          element.classList.toggle("hidden-by-extension", isContentHidden);
        });
      });
    }
    const button = document.querySelector(
      '.algorithm-escape-toggle-container[data-group="instagram"] .algorithm-escape-toggle'
    );
    updateToggleButton(button);
  } else if (currentSite === "twitter") {
    console.log("Hiding/Showing Twitter content");
    debugTwitterPageType();

    if (sites.twitter.isAllowedPage()) {
      console.log("On a special Twitter page, not hiding content");
      return;
    }

    sites.twitter.selectors.forEach(({ name, selector }) => {
      const elements = document.querySelectorAll(selector);
      console.log(`Found ${elements.length} elements for ${name}`);
      elements.forEach((element) => {
        if (
          !element.closest(sites.twitter.tweetBoxSelector) &&
          !element.closest(sites.twitter.searchBoxSelector)
        ) {
          element.style.display = isContentHidden ? "none" : "";
          console.log(`Set display to ${element.style.display} for ${name}`);
        }
      });
    });

    // Ensure tweet composition area and search bar are always visible
    const tweetBox = document.querySelector(sites.twitter.tweetBoxSelector);
    if (tweetBox) {
      const tweetBoxContainer = tweetBox.closest(
        '[data-testid="primaryColumn"] > div > div'
      );
      if (tweetBoxContainer) {
        tweetBoxContainer.style.display = "";
      }
    }

    const searchBox = document.querySelector(sites.twitter.searchBoxSelector);
    if (searchBox) {
      const searchBoxContainer = searchBox.closest('[role="search"]');
      if (searchBoxContainer) {
        searchBoxContainer.style.display = "";
      }
    }

    const button = document.querySelector(
      '.algorithm-escape-toggle-container[data-group="twitter"] .algorithm-escape-toggle'
    );
    updateToggleButton(button);

    if (isContentHidden) {
    }
  } else if (currentSite === "tiktok") {
    if (sites.tiktok.isAllowedPage()) {
      return;
    }
    sites.tiktok.selectorGroups.forEach((group) => {
      const elements = document.querySelectorAll(group.selector);
      elements.forEach((element) => {
        element.style.display = isContentHidden ? "none" : "";
      });
    });
    if (isContentHidden) {
      pauseAllVideos();
    }
    const button = document.querySelector(
      '.algorithm-escape-toggle-container[data-group="tiktok"] .algorithm-escape-toggle'
    );
    updateToggleButton(button);
  } else if (currentSite === "pinterest") {
    if (sites.pinterest.isAllowedPage()) {
      return;
    }
    sites.pinterest.selectorGroups.forEach((group) => {
      const elements = document.querySelectorAll(group.selector);
      elements.forEach((element) => {
        element.style.display = isContentHidden ? "none" : "";
      });
    });
    const button = document.querySelector(
      '.algorithm-escape-toggle-container[data-group="pinterest"] .algorithm-escape-toggle'
    );
    updateToggleButton(button);
  } else if (currentSite === "linkedin") {
    if (sites.linkedin.isAllowedPage()) {
      return;
    }
    sites.linkedin.selectorGroups.forEach((group) => {
      const elements = document.querySelectorAll(group.selector);
      elements.forEach((element) => {
        element.style.display = isContentHidden ? "none" : "";
      });
    });
    const button = document.querySelector(
      '.algorithm-escape-toggle-container[data-group="linkedin"] .algorithm-escape-toggle'
    );
    updateToggleButton(button);
  } else if (currentSite === "reddit") {
    if (sites.reddit.isAllowedPage()) {
      return;
    }
    sites.reddit.selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        element.classList.toggle("hidden-by-extension", isContentHidden);
      });
    });
    const button = document.querySelector(
      '.algorithm-escape-toggle-container[data-group="reddit"] .algorithm-escape-toggle'
    );
    updateToggleButton(button);
  }
}

function pauseAllVideos() {
  const videos = document.querySelectorAll("video");
  videos.forEach((video) => {
    video.pause();
    video.muted = true;
  });
}

function hideYoutubeShorts() {
  const shortsContainer = document.querySelector("#page-manager > ytd-shorts");
  if (shortsContainer) {
    shortsContainer.style.display = isContentHidden ? "none" : "";
    const videos = shortsContainer.querySelectorAll("video");
    videos.forEach((video) => {
      if (isContentHidden) {
        video.pause();
        video.muted = true;
      } else {
        video.muted = false;
      }
    });
    if (
      !document.querySelector(
        '.algorithm-escape-toggle-container[data-group="shorts-feed"]'
      )
    ) {
      createToggleButton(document.body, "shorts-feed", true);
    }
  }
}

function handleYoutubeNavigation() {
  if (getCurrentSite() === "youtube") {
    if (sites.youtube.isShortsPage()) {
      hideYoutubeShorts();
    } else {
      initializeSite();
    }
    // Always try to hide Shorts shelf
    const shortsShelf = document.querySelector("ytd-reel-shelf-renderer");
    if (shortsShelf) {
      shortsShelf.style.display = "none";
    }
  }
}

function periodicShortsCheck() {
  if (getCurrentSite() === "youtube") {
    const shortsContainer = document.querySelector(
      "#page-manager > ytd-shorts"
    );
    if (shortsContainer) {
      shortsContainer.style.display = isContentHidden ? "none" : "";
      const videos = shortsContainer.querySelectorAll("video");
      videos.forEach((video) => {
        if (isContentHidden) {
          video.pause();
          video.muted = true;
        }
      });
    }
    const shortsShelf = document.querySelector("ytd-reel-shelf-renderer");
    if (shortsShelf) {
      shortsShelf.style.display = isContentHidden ? "none" : "";
    }
  }
}

function debugTwitterPageType() {
  console.log("Notifications page:", sites.twitter.isNotificationsPage());
  console.log("Single tweet page:", sites.twitter.isSingleTweetPage());
  console.log("Timeline page:", sites.twitter.isTimelinePage());
  console.log("Profile page:", sites.twitter.isProfilePage());
  console.log("Bookmarks page:", sites.twitter.isBookmarksPage());
}

function periodicTikTokCheck() {
  if (getCurrentSite() === "tiktok" && siteEnabled) {
    console.log("Periodic TikTok check"); // Debug log
    sites.tiktok.selectorGroups.forEach((group) => {
      const elements = document.querySelectorAll(group.selector);
      elements.forEach((element) => {
        if (isContentHidden) {
          element.style.display = "none";
        }
      });
    });
    if (isContentHidden) {
      pauseAllVideos();
    }
  }
}

const observer = new MutationObserver(() => {
  if (isContentHidden && siteEnabled) {
    initializeSite();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

setInterval(() => {
  if (isContentHidden && siteEnabled) {
    if (getCurrentSite() === "youtube") {
      initializeSite();
      handleYoutubeNavigation();
      periodicShortsCheck();
    } else if (getCurrentSite() === "tiktok") {
      periodicTikTokCheck();
    } else if (getCurrentSite() === "linkedin") {
      initializeSite();
    } else if (
      getCurrentSite() === "facebook" &&
      sites.facebook.isReelsPage()
    ) {
      // Reels autoplay without changing the DOM, so the observer alone can miss them
      hideFacebookReels();
    }
  }
}, 1000);

const storage = chrome.storage || browser.storage;

storage.onChanged.addListener(function (changes, namespace) {
  console.log("changing site " + namespace + " with changes:", changes);
  for (let key in changes) {
    if (key === getCurrentSite()) {
      siteEnabled = changes[key].newValue !== false;
      if (siteEnabled) {
        isContentHidden = true;
        initializeSite();
      } else {
        showAllContent();
        stopCountdown();
      }
    }
    if (LIMIT_SETTING_KEYS.includes(key)) {
      // Re-read all limit settings so one change doesn't reset the others
      storage.sync.get(LIMIT_SETTING_KEYS).then((result) => {
        applyLimitSettings(result);
        enforceTwitterDailyLimit();
      });
    }
    if (key === "twitterUsage") {
      // Another X tab may have used up the budget
      enforceTwitterDailyLimit();
    }
    if (key === "hardcore") {
      hardcoreMode = changes[key].newValue === true;
      // Remove existing toggle buttons when hardcore mode is enabled
      if (hardcoreMode) {
        const buttons = document.querySelectorAll(".algorithm-escape-toggle-container");
        buttons.forEach((button) => button.remove());
      } else if (siteEnabled) {
        // Re-initialize to create toggle buttons when hardcore mode is disabled
        initializeSite();
      }
    }
  }
});

const runtime = chrome.runtime || browser.runtime;

runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "pageChanged") {
    // Handle the page change action
    sendResponse({ received: true });
  }
  return true; // Indicates that the response will be sent asynchronously
});

/**
 * Daily usage counters live in storage.local as { date, ...counts } and are
 * treated as empty once the date no longer matches today, so they reset at
 * local midnight without any cleanup.
 */
async function getTodayUsage(key, emptyUsage) {
  const result = await storage.local.get(key);
  const usage = result[key];
  return usage && usage.date === todayKey()
    ? usage
    : { date: todayKey(), ...emptyUsage };
}

function isOverTwitterDailyLimit(usage) {
  return (
    twitterDailyLimitMinutes > 0 &&
    usage.seconds >= twitterDailyLimitMinutes * 60
  );
}

async function enforceTwitterDailyLimit() {
  if (getCurrentSite() !== "twitter") return;
  const usage = await getTodayUsage("twitterUsage", { seconds: 0 });
  if (isOverTwitterDailyLimit(usage)) {
    showDailyLimitOverlay();
  } else {
    removeDailyLimitOverlay();
  }
}

function showDailyLimitOverlay() {
  pauseAllVideos();
  if (document.querySelector(".algorithm-escape-limit-overlay")) return;

  const isDarkMode =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const bgColor = isDarkMode ? "#1a1a2e" : "#ffffff";
  const textColor = isDarkMode ? "#e0e0e0" : "#333333";

  const overlay = document.createElement("div");
  overlay.className = "algorithm-escape-limit-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    backgroundColor: bgColor,
    color: textColor,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
    textAlign: "center",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  });
  overlay.innerHTML = `
        <h2 style="color: #e94560; font-size: 22px; margin: 0 0 12px;">That's your ${twitterDailyLimitMinutes} minutes of X for today</h2>
        <p style="font-size: 16px; margin: 0;">You are escaping the algorithm 😎 Come back tomorrow.</p>
    `;
  document.documentElement.appendChild(overlay);
  document.documentElement.style.overflow = "hidden";
}

function removeDailyLimitOverlay() {
  const overlay = document.querySelector(".algorithm-escape-limit-overlay");
  if (overlay) {
    overlay.remove();
    document.documentElement.style.overflow = "";
  }
}

function trackTwitterUsage() {
  // Count time only while an X tab is on screen. Usage is tracked even with
  // no limit set so the popup can show how much time was spent today.
  setInterval(async () => {
    if (document.visibilityState !== "visible") return;
    const usage = await getTodayUsage("twitterUsage", { seconds: 0 });
    if (isOverTwitterDailyLimit(usage)) {
      // Re-add the overlay in case the page removed it
      showDailyLimitOverlay();
      return;
    }
    // A tab left open past midnight starts a fresh day under the limit
    removeDailyLimitOverlay();
    usage.seconds += USAGE_TICK_SECONDS;
    await storage.local.set({ twitterUsage: usage });
    if (isOverTwitterDailyLimit(usage)) showDailyLimitOverlay();
  }, USAGE_TICK_SECONDS * 1000);
}

checkSiteEnabled();

if (getCurrentSite() === "twitter") {
  storage.sync.get(LIMIT_SETTING_KEYS).then((result) => {
    applyLimitSettings(result);
    enforceTwitterDailyLimit();
  });
  trackTwitterUsage();
}
