let isContentHidden = true;
let siteEnabled = true;

const sites = {
    youtube: {
        selectorGroups: [
            {
                name: 'main-feed',
                selector: 'div#contents.style-scope.ytd-rich-grid-renderer'
            },
            {
                name: 'end-screen',
                selector: '.ytp-endscreen-content, .ytp-ce-element'
            },
            {
              name: 'shorts-feed',
              selector: '#page-manager > ytd-shorts'
          }
        ],
        channelVideosSelector: '#contents.ytd-rich-grid-renderer',
        additionalActions: function() {
            this.disableAutoplay();
        },

        disableAutoplay: function() {
            const autoplayToggle = document.querySelector('.ytp-autonav-toggle-button');
            if (autoplayToggle && autoplayToggle.getAttribute('aria-checked') === 'true') {
                autoplayToggle.click();
            }

            if (window.yt && window.yt.player && window.yt.player.getPlayer) {
                const player = window.yt.player.getPlayer();
                if (player && player.pauseVideo) {
                    const originalPauseVideo = player.pauseVideo;
                    player.pauseVideo = function() {
                        originalPauseVideo.apply(this, arguments);
                        if (this.cancelPlayback) {
                            this.cancelPlayback();
                        }
                    };
                }
            }
        },
        isAllowedPage: function() {
            return window.location.pathname.includes('/videos') || 
                   window.location.pathname.includes('/feed/subscriptions');
        },
        isShortsPage: function() {
            return window.location.pathname.includes('/shorts');
        }
    },
    facebook: {
        getNewsfeed: function() {
            const mainContent = document.querySelector('div[role="main"]');
            if (!mainContent) return null;

            const possibleFeeds = mainContent.querySelectorAll('div > div > div > div > div > div > div > div');
            for (let feed of possibleFeeds) {
                if (feed.querySelector('[role="article"]')) {
                    return feed;
                }
            }
            return null;
        }
    },
    instagram: {
        selectors: [
            'div[role="menu"]',
            'main[role="main"] > div > div'
        ]
    },
    twitter: {
        selectors: [
            {
                name: 'main-feed',
                selector: '[data-testid="primaryColumn"] [data-testid="cellInnerDiv"]'
            },
            {
                name: 'sidebar-content',
                selector: '[data-testid="sidebarColumn"] > div > div:not(:first-child)'
            }
        ],
        tweetBoxSelector: '[data-testid="tweetTextarea_0"]',
        isNotificationsPage: function() {
            return window.location.pathname.includes('/notifications');
        },
        isProfilePage: function() {
            return /^\/[^\/]+$/.test(window.location.pathname) && 
                   !window.location.pathname.includes('/home') && 
                   !window.location.pathname.includes('/status/');
        },
        isSingleTweetPage: function() {
            return window.location.pathname.includes('/status/');
        },
        isTimelinePage: function() {
            return window.location.pathname.includes('/i/timeline');
        },
        getTweetBox: function() {
            return document.querySelector('[data-testid="tweetTextarea_0"]');
        },
        getTweetBoxContainer: function() {
            const tweetBox = document.querySelector(this.tweetBoxSelector);
            return tweetBox ? tweetBox.closest('[data-testid="primaryColumn"] > div > div') : null;
        }
    },
    tiktok: {
        selectorGroups: [
            {
                name: 'main-feed',
                selector: '#main-content-homepage_hot'
            },
            {
                name: 'explore-feed',
                selector: '#main-content-explore_page'
            },
            {
                name: 'live-feed',
                selector: '#tiktok-live-main-container-id'
            }
        ],
        isAllowedPage: function() {
            return false; // Block all pages by default
        }
    }
};

function getCurrentSite() {
    if (window.location.hostname.includes('youtube.com')) return 'youtube';
    if (window.location.hostname.includes('facebook.com')) return 'facebook';
    if (window.location.hostname.includes('instagram.com')) return 'instagram';
    if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) return 'twitter';
    if (window.location.hostname.includes('tiktok.com')) return 'tiktok';
    return null;
}

function checkSiteEnabled() {
    const currentSite = getCurrentSite();
    if (currentSite) {
        chrome.storage.sync.get(currentSite, function(result) {
            siteEnabled = result[currentSite] !== false;
            if (!siteEnabled) {
                showAllContent();
            } else {
                initializeSite();
            }
        });
    }
}

function initializeSite() {
    if (!siteEnabled) return;
    
    const currentSite = getCurrentSite();
    if (currentSite === 'youtube') {
        if (sites.youtube.isShortsPage()) {
            hideYoutubeShorts();
        } else if (!sites.youtube.isAllowedPage()) {
            sites.youtube.selectorGroups.forEach(group => {
                const elements = document.querySelectorAll(group.selector);
                if (elements.length > 0) {
                    elements.forEach(element => {
                        if (group.name === 'shorts-feed') {
                            element.style.display = isContentHidden ? 'none' : '';
                        } else {
                            element.classList.toggle('hidden-by-extension', isContentHidden);
                        }
                    });
                    createToggleButton(elements[0], group.name);
                }
            });
            sites.youtube.additionalActions();
        }
        // Always try to hide Shorts shelf
        const shortsShelf = document.querySelector('ytd-reel-shelf-renderer');
        if (shortsShelf) {
            shortsShelf.style.display = isContentHidden ? 'none' : '';
        }
    } else if (currentSite === 'facebook') {
        const newsfeed = sites.facebook.getNewsfeed();
        if (newsfeed && !newsfeed.classList.contains('hidden-by-extension')) {
            newsfeed.classList.add('hidden-by-extension');
            createToggleButton(newsfeed, 'facebook-feed');
        }
        // Add an observer for Facebook to handle dynamic content loading
        const facebookObserver = new MutationObserver(() => {
            const newsfeed = sites.facebook.getNewsfeed();
            if (newsfeed && !newsfeed.classList.contains('hidden-by-extension') && !document.querySelector('.algorithm-escape-toggle-container[data-group="facebook-feed"]')) {
                newsfeed.classList.add('hidden-by-extension');
                createToggleButton(newsfeed, 'facebook-feed');
            }
        });
        facebookObserver.observe(document.body, { childList: true, subtree: true });
    } else if (currentSite === 'instagram') {
        let contentFound = false;

        if (contentFound && !document.querySelector('.algorithm-escape-toggle-container[data-group="instagram"]')) {
            createToggleButton(document.body, 'instagram', true);
        }

        sites.instagram.selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                contentFound = true;
                elements.forEach(element => {
                    if (!element.classList.contains('hidden-by-extension')) {
                        element.classList.add('hidden-by-extension');
                    }
                });
            }
        });
        if (contentFound && !document.querySelector('.algorithm-escape-toggle-container[data-group="instagram"]')) {
            createToggleButton(document.body, 'instagram', true);
        }
    } else if (currentSite === 'twitter') {
        console.log('Initializing Twitter');
        debugTwitterPageType();

        if (sites.twitter.isNotificationsPage() || sites.twitter.isSingleTweetPage() || sites.twitter.isProfilePage()) {
            console.log('On a special Twitter page, not hiding content');
            return;
        }

        let contentFound = false;
        sites.twitter.selectors.forEach(({name, selector}) => {
            const elements = document.querySelectorAll(selector);
            console.log(`Found ${elements.length} elements for ${name}`);
            if (elements.length > 0) {
                contentFound = true;
                elements.forEach(element => {
                    if (!element.closest(sites.twitter.tweetBoxSelector) && 
                        !element.closest(sites.twitter.searchBoxSelector)) {
                        element.style.display = isContentHidden ? 'none' : '';
                        console.log(`Set display to ${element.style.display} for ${name}`);
                    }
                });
            }
        });

        // Ensure tweet composition area and search bar are always visible
        const tweetBox = document.querySelector(sites.twitter.tweetBoxSelector);
        if (tweetBox) {
            const tweetBoxContainer = tweetBox.closest('[data-testid="primaryColumn"] > div > div');
            if (tweetBoxContainer) {
                tweetBoxContainer.style.display = '';
            }
        }

        const searchBox = document.querySelector(sites.twitter.searchBoxSelector);
        if (searchBox) {
            const searchBoxContainer = searchBox.closest('[role="search"]');
            if (searchBoxContainer) {
                searchBoxContainer.style.display = '';
            }
        }

        if (contentFound && !document.querySelector('.algorithm-escape-toggle-container[data-group="twitter"]')) {
            console.log('Creating toggle button for Twitter');
            createToggleButton(document.body, 'twitter', true);
        }
    } else if (currentSite === 'tiktok') {
    console.log('Initializing TikTok'); // Debug log
    let contentFound = false;

    if (!sites.tiktok.isAllowedPage()) {
        sites.tiktok.selectorGroups.forEach(group => {
            const elements = document.querySelectorAll(group.selector);
            console.log(`Found ${elements.length} elements for selector: ${group.selector}`); // Debug log
            if (elements.length > 0) {
                contentFound = true;
                elements.forEach(element => {
                    element.style.display = 'none';
                    console.log('Element hidden:', element); // Debug log
                });
            }
        });

        if (contentFound && !document.querySelector('.algorithm-escape-toggle-container[data-group="tiktok"]')) {
            console.log('Creating toggle button for TikTok'); // Debug log
            createToggleButton(document.body, 'tiktok', true);
        }

        pauseAllVideos();
    }
}   
}

function showAllContent() {
    const currentSite = getCurrentSite();
    if (currentSite === 'youtube') {
        sites.youtube.selectorGroups.forEach(group => {
            const elements = document.querySelectorAll(group.selector);
            elements.forEach(element => {
                element.classList.remove('hidden-by-extension');
            });
        });
    } else if (currentSite === 'facebook') {
        const newsfeed = sites.facebook.getNewsfeed();
        if (newsfeed) {
            newsfeed.classList.remove('hidden-by-extension');
        }
    } else if (currentSite === 'instagram') {
        sites.instagram.selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.classList.remove('hidden-by-extension');
            });
        });
    } else if (currentSite === 'twitter') {
        if (sites.twitter.isNotificationsPage()) {
            return;
        }
        sites.twitter.selectors.forEach(({selector}) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.classList.remove('hidden-by-extension');
            });
        });
    } else if (currentSite === 'tiktok') {
        sites.tiktok.selectors.forEach(({selector}) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.classList.remove('hidden-by-extension');
            });
        });
    }
    
    
    const buttons = document.querySelectorAll('.algorithm-escape-toggle-container');
    buttons.forEach(button => button.remove());
}

function createToggleButton(element, groupName, fixed = false) {
    let container = document.querySelector(`.algorithm-escape-toggle-container[data-group="${groupName}"]`);
    if (container) return container.querySelector('.algorithm-escape-toggle');

    container = document.createElement('div');
    container.className = 'algorithm-escape-toggle-container';
    container.setAttribute('data-group', groupName);

    if (fixed) {
        container.style.position = 'fixed';
        container.style.top = '60px';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
        container.style.zIndex = '9999999';
        container.style.backgroundColor = 'white';
        container.style.padding = '10px';
        container.style.borderRadius = '5px';
        container.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    } else {
        container.style.position = 'sticky';
        container.style.top = '0';
        container.style.zIndex = '9999';
        container.style.backgroundColor = 'white';
        container.style.padding = '10px';
        container.style.textAlign = 'center';
    }

    const button = document.createElement('button');
    button.className = 'algorithm-escape-toggle';
    button.textContent = 'Show Hidden Content';

    const text = document.createElement('p');
    text.className = 'algorithm-escape-text';
    text.textContent = 'You are escaping the algorithm 😎';

    container.appendChild(button);
    container.appendChild(text);

    const currentSite = getCurrentSite();

    if (currentSite === 'twitter') {
        const tweetBox = sites.twitter.getTweetBox();
        if (tweetBox) {
            const tweetBoxContainer = tweetBox.closest('[data-testid="primaryColumn"] > div > div');
            if (tweetBoxContainer) {
                tweetBoxContainer.parentNode.insertBefore(container, tweetBoxContainer.nextSibling);
            }
        }
    } else if (currentSite === 'instagram' || currentSite === 'tiktok') {
        document.body.appendChild(container);
    } else if (element) {
        element.parentNode.insertBefore(container, element);
    } else {
        document.body.appendChild(container);
    }

    button.addEventListener('click', () => toggleContent(groupName));
    return button;
}

function toggleContent(groupName) {
    isContentHidden = !isContentHidden;
    const currentSite = getCurrentSite();
    if (currentSite === 'twitter') {
        sites.twitter.selectors.forEach(({name, selector}) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.setProperty('display', isContentHidden ? 'none' : '', 'important');
            });
        });
        const button = document.querySelector('.algorithm-escape-toggle-container[data-group="twitter"] .algorithm-escape-toggle');
        updateToggleButton(button);
    } else {
        hideOrShowContent(groupName);
    }
}

function updateToggleButton(button) {
    if (button) {
        const text = button.nextElementSibling;
        button.textContent = isContentHidden ? 'Show Hidden Content' : 'Hide Content';
        text.textContent = isContentHidden ? 'You are escaping the algorithm 😎' : 'Don\'t get sucked in 😱';
    }
}

function hideOrShowContent(groupName) {
    const currentSite = getCurrentSite();
    if (currentSite === 'youtube') {
        if (sites.youtube.isAllowedPage()) {
            return;
        }
        if (groupName === 'shorts-feed') {
            hideYoutubeShorts();
        } else {
            const group = sites.youtube.selectorGroups.find(g => g.name === groupName);
            if (group) {
                const elements = document.querySelectorAll(group.selector);
                elements.forEach(element => {
                    element.classList.toggle('hidden-by-extension', isContentHidden);
                });
            }
        }
        const button = document.querySelector(`.algorithm-escape-toggle-container[data-group="${groupName}"] .algorithm-escape-toggle`);
        updateToggleButton(button);

        if (isContentHidden) {
            sites.youtube.additionalActions();
        }
    } else if (currentSite === 'facebook') {
        const newsfeed = sites.facebook.getNewsfeed();
        if (newsfeed) {
            newsfeed.classList.toggle('hidden-by-extension', isContentHidden);
            const button = newsfeed.previousElementSibling.querySelector('.algorithm-escape-toggle');
            updateToggleButton(button);
        }
    } else if (currentSite === 'instagram') {
        sites.instagram.selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.classList.toggle('hidden-by-extension', isContentHidden);
            });
        });
        const button = document.querySelector('.algorithm-escape-toggle-container[data-group="instagram"] .algorithm-escape-toggle');
        updateToggleButton(button);
    } else     if (currentSite === 'twitter') {
        console.log('Hiding/Showing Twitter content');
        debugTwitterPageType();

        if (sites.twitter.isNotificationsPage() || sites.twitter.isSingleTweetPage() || sites.twitter.isProfilePage()) {
            console.log('On a special Twitter page, not hiding content');
            return;
        }

        sites.twitter.selectors.forEach(({name, selector}) => {
            const elements = document.querySelectorAll(selector);
            console.log(`Found ${elements.length} elements for ${name}`);
            elements.forEach(element => {
                if (!element.closest(sites.twitter.tweetBoxSelector) && 
                    !element.closest(sites.twitter.searchBoxSelector)) {
                    element.style.display = isContentHidden ? 'none' : '';
                    console.log(`Set display to ${element.style.display} for ${name}`);
                }
            });
        });

        // Ensure tweet composition area and search bar are always visible
        const tweetBox = document.querySelector(sites.twitter.tweetBoxSelector);
        if (tweetBox) {
            const tweetBoxContainer = tweetBox.closest('[data-testid="primaryColumn"] > div > div');
            if (tweetBoxContainer) {
                tweetBoxContainer.style.display = '';
            }
        }

        const searchBox = document.querySelector(sites.twitter.searchBoxSelector);
        if (searchBox) {
            const searchBoxContainer = searchBox.closest('[role="search"]');
            if (searchBoxContainer) {
                searchBoxContainer.style.display = '';
            }
        }

        const button = document.querySelector('.algorithm-escape-toggle-container[data-group="twitter"] .algorithm-escape-toggle');
        updateToggleButton(button);

        if (isContentHidden) {
        }
    } else if (currentSite === 'tiktok') {
        if (sites.tiktok.isAllowedPage()) {
            return;
        }
        sites.tiktok.selectorGroups.forEach(group => {
            const elements = document.querySelectorAll(group.selector);
            elements.forEach(element => {
                element.style.display = isContentHidden ? 'none' : '';
            });
        });
        if (isContentHidden) {
            pauseAllVideos();
        }
        const button = document.querySelector('.algorithm-escape-toggle-container[data-group="tiktok"] .algorithm-escape-toggle');
        updateToggleButton(button);
    }
}

function pauseAllVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
        video.pause();
        video.muted = true;
    });
}

function hideYoutubeShorts() {
    const shortsContainer = document.querySelector('#page-manager > ytd-shorts');
    if (shortsContainer) {
        shortsContainer.style.display = isContentHidden ? 'none' : '';
        const videos = shortsContainer.querySelectorAll('video');
        videos.forEach(video => {
            if (isContentHidden) {
                video.pause();
                video.muted = true;
            } else {
                video.muted = false;
            }
        });
        if (!document.querySelector('.algorithm-escape-toggle-container[data-group="shorts-feed"]')) {
            createToggleButton(document.body, 'shorts-feed', true);
        }
    }
}

function handleYoutubeNavigation() {
    if (getCurrentSite() === 'youtube') {
        if (sites.youtube.isShortsPage()) {
            hideYoutubeShorts();
        } else {
            initializeSite();
        }
        // Always try to hide Shorts shelf
        const shortsShelf = document.querySelector('ytd-reel-shelf-renderer');
        if (shortsShelf) {
            shortsShelf.style.display = 'none';
        }
    }
}

// if (getCurrentSite() === 'youtube') {
//     window.addEventListener('yt-navigate-finish', handleYoutubeNavigation);
// }

function periodicShortsCheck() {
    if (getCurrentSite() === 'youtube') {
        const shortsContainer = document.querySelector('#page-manager > ytd-shorts');
        if (shortsContainer) {
            shortsContainer.style.display = isContentHidden ? 'none' : '';
            const videos = shortsContainer.querySelectorAll('video');
            videos.forEach(video => {
                if (isContentHidden) {
                    video.pause();
                    video.muted = true;
                }
            });
        }
        const shortsShelf = document.querySelector('ytd-reel-shelf-renderer');
        if (shortsShelf) {
            shortsShelf.style.display = isContentHidden ? 'none' : '';
        }
    }
}


function debugTwitterPageType() {
    console.log('Notifications page:', sites.twitter.isNotificationsPage());
    console.log('Single tweet page:', sites.twitter.isSingleTweetPage());
    console.log('Timeline page:', sites.twitter.isTimelinePage());
    console.log('Profile page:', sites.twitter.isProfilePage());
}

function periodicTikTokCheck() {
    if (getCurrentSite() === 'tiktok' && siteEnabled) {
        console.log('Periodic TikTok check'); // Debug log
        sites.tiktok.selectorGroups.forEach(group => {
            const elements = document.querySelectorAll(group.selector);
            elements.forEach(element => {
                if (isContentHidden) {
                    element.style.display = 'none';
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
        if (getCurrentSite() === 'youtube') {
            initializeSite();
            handleYoutubeNavigation();
            periodicShortsCheck();
        } else if (getCurrentSite() === 'tiktok') {
            periodicTikTokCheck();
        }
    }
}, 1000);

chrome.storage.onChanged.addListener(function(changes, namespace) {
    console.log("changing site " + namespace + " with changes: " + changes);
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

checkSiteEnabled();
