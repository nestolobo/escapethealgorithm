import browser from "webextension-polyfill";

let isContentHidden = true;
let siteEnabled = true;

function showBody() {
  document.body.style.display = "";
}

const sites = {
  youtube: {
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
      return (
        window.location.pathname.includes("/videos") ||
        window.location.pathname.includes("/feed/subscriptions")
      );
    },
    isShortsPage: function () {
      return window.location.pathname.includes("/shorts");
    },
  },
  twitter: {
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
    isProfilePage: function () {
      return (
        /^\/[^\/]+$/.test(window.location.pathname) &&
        !window.location.pathname.includes("/home")
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
    selectors: ['div[role="menu"]', 'main[role="main"] > div > div'],
  },
  tiktok: {
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
};

function getCurrentSite() {
  if (window.location.hostname.includes("youtube.com")) return "youtube";
  if (window.location.hostname.includes("facebook.com")) return "facebook";
  if (window.location.hostname.includes("instagram.com")) return "instagram";
  if (
    window.location.hostname.includes("twitter.com") ||
    window.location.hostname.includes("x.com")
  )
    return "twitter";
  if (window.location.hostname.includes("tiktok.com")) return "tiktok";
  return null;
}

function checkSiteEnabled() {
  const currentSite = getCurrentSite();
  if (currentSite) {
    const storage = chrome.storage || browser.storage;
    storage.sync
      .get(currentSite)
      .then((result) => {
        siteEnabled = result[currentSite] !== false;
        showBody(); // Always show the body
        if (!siteEnabled) {
          showAllContent();
        } else {
          initializeSite();
        }
      })
      .catch((error) => {
        console.error("Error accessing storage:", error);
        showBody(); // Always show the body
        siteEnabled = true;
        initializeSite();
      });
  } else {
    showBody(); // Always show the body for unrecognized sites
  }
}

function initializeSite() {
  if (!siteEnabled) return;

  const currentSite = getCurrentSite();
  if (currentSite === "youtube") {
    if (sites.youtube.isShortsPage()) {
      hideYoutubeShorts();
    } else if (!sites.youtube.isAllowedPage()) {
      sites.youtube.selectorGroups.forEach((group) => {
        const elements = document.querySelectorAll(group.selector);
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
    let contentFound = false;

    if (
      contentFound &&
      !document.querySelector(
        '.algorithm-escape-toggle-container[data-group="instagram"]'
      )
    ) {
      createToggleButton(document.body, "instagram", true);
    }

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
  }
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
  }

  const buttons = document.querySelectorAll(
    ".algorithm-escape-toggle-container"
  );
  buttons.forEach((button) => button.remove());
}

function createToggleButton(element, groupName, fixed = false) {
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

  container.appendChild(closeButton);
  container.appendChild(button);
  container.appendChild(text);

  const currentSite = getCurrentSite();

  if (currentSite === "twitter") {
    const tweetBox = sites.twitter.getTweetBox();
    if (tweetBox) {
      const tweetBoxContainer = tweetBox.closest(
        '[data-testid="primaryColumn"] > div > div'
      );
      if (tweetBoxContainer) {
        tweetBoxContainer.parentNode.insertBefore(
          container,
          tweetBoxContainer.nextSibling
        );
      }
    }
  } else if (currentSite === "instagram" || currentSite === "tiktok") {
    document.body.appendChild(container);
  } else if (element) {
    element.parentNode.insertBefore(container, element);
  } else {
    document.body.appendChild(container);
  }

  button.addEventListener("click", () => toggleContent(groupName));

  // Trigger animation after a short delay
  setTimeout(() => {
    container.style.opacity = "1";
    addSparkle(container);
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

function addSparkle(container) {
  const sparkleCount = 5;
  for (let i = 0; i < sparkleCount; i++) {
    const sparkle = document.createElement("div");
    Object.assign(sparkle.style, {
      position: "absolute",
      width: "2px",
      height: "2px",
      borderRadius: "50%",
      backgroundColor: "#e94560",
      top: Math.random() * 100 + "%",
      left: Math.random() * 100 + "%",
      opacity: 0,
      animation: `sparkle 0.8s ease-in-out ${Math.random() * 0.5}s`,
    });
    container.appendChild(sparkle);
  }
}

async function toggleContent(groupName) {
  if (!isContentHidden) {
    // If content is already shown, hide it without confirmation
    isContentHidden = true;
    hideOrShowContent(groupName);
  } else {
    // If content is hidden, show confirmation modal
    const shouldShow = await createModal();
    if (shouldShow) {
      isContentHidden = false;
      hideOrShowContent(groupName);
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
  }
}

function createModal() {
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
            <h2>Are you sure you actually want to show this content?</h2>
            <button id="confirmShow" class="algorithm-escape-modal-button">Yes, I'm sure</button>
            <button id="cancelShow" class="algorithm-escape-modal-button">Honestly, no</button>
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
    document.getElementById("confirmShow").addEventListener("click", () => {
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
        const elements = document.querySelectorAll(group.selector);
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
    const newsfeed = sites.facebook.getNewsfeed();
    if (newsfeed) {
      newsfeed.classList.toggle("hidden-by-extension", isContentHidden);
      const button = newsfeed.previousElementSibling.querySelector(
        ".algorithm-escape-toggle"
      );
      updateToggleButton(button);
    }
  } else if (currentSite === "instagram") {
    sites.instagram.selectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        element.classList.toggle("hidden-by-extension", isContentHidden);
      });
    });
    const button = document.querySelector(
      '.algorithm-escape-toggle-container[data-group="instagram"] .algorithm-escape-toggle'
    );
    updateToggleButton(button);
  } else if (currentSite === "twitter") {
    console.log("Hiding/Showing Twitter content");
    debugTwitterPageType();

    if (
      sites.twitter.isNotificationsPage() ||
      sites.twitter.isSingleTweetPage() ||
      sites.twitter.isProfilePage()
    ) {
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

// if (getCurrentSite() === 'youtube') {
//     window.addEventListener('yt-navigate-finish', handleYoutubeNavigation);
// }

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
        initializeSite();
      } else {
        showAllContent();
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

checkSiteEnabled();
