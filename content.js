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
                name: 'shorts',
                selector: 'ytd-reel-shelf-renderer'
            },
            {
                name: 'shorts-feed',
                selector: 'ytd-shorts#shorts-container'
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
                name: 'explore',
                selector: '[data-testid="sidebarColumn"] [aria-label="Search and explore"]'
            },
            {
                name: 'who-to-follow',
                selector: '[data-testid="sidebarColumn"] [aria-label="Who to follow"]'
            }
        ],
        isNotificationsPage: function() {
            return window.location.pathname.includes('/notifications');
        }
    },
    tiktok: {
        selectorGroups: [
            {
                name: 'main-feed',
                selector: '#main-content-homepage_hot'
            }
        ],
        isAllowedPage: function() {
            return false; // Block all pages by default
        }
    }
};

function createToggleButton(element, groupName, fixed = false) {
    let container = document.querySelector(`.algorithm-escape-toggle-container[data-group="${groupName}"]`);
    if (container) return container.querySelector('.algorithm-escape-toggle');

    container = document.createElement('div');
    container.className = 'algorithm-escape-toggle-container';
    container.setAttribute('data-group', groupName);

    if (fixed || groupName === 'tiktok-feed') {
        container.style.position = 'fixed';
        container.style.top = '60px';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
        container.style.zIndex = '9999999';
        container.style.backgroundColor = 'white';
        container.style.padding = '10px';
        container.style.borderRadius = '5px';
        container.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    }

    const button = document.createElement('button');
    button.className = 'algorithm-escape-toggle';
    button.textContent = 'Show Hidden Content';

    const text = document.createElement('p');
    text.className = 'algorithm-escape-text';
    text.textContent = 'You are escaping the algorithm 😎';

    container.appendChild(button);
    container.appendChild(text);

    if (fixed || groupName === 'tiktok-feed') {
        document.body.appendChild(container);
    } else {
        element.parentNode.insertBefore(container, element);
    }

    button.addEventListener('click', () => toggleContent(groupName));
    return button;
}

function toggleContent(groupName) {
    isContentHidden = !isContentHidden;
    hideOrShowContent(groupName);
}

function updateToggleButton(button) {
    if (button) {
        const text = button.nextElementSibling;
        button.textContent = isContentHidden ? 'Show Hidden Content' : 'Hide Content';
        text.textContent = isContentHidden ? 'You are escaping the algorithm 😎' : 'Don\'t get sucked in 😱';
    }
}

function getCurrentSite() {
    if (window.location.hostname.includes('youtube.com')) return 'youtube';
    if (window.location.hostname.includes('facebook.com')) return 'facebook';
    if (window.location.hostname.includes('instagram.com')) return 'instagram';
    if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) return 'twitter';
    if (window.location.hostname.includes('tiktok.com')) return 'tiktok';
    return null;
}

function hideOrShowContent(groupName) {
    const currentSite = getCurrentSite();
    if (currentSite === 'youtube') {
        if (sites.youtube.isAllowedPage()) {
            return;
        }
        const group = sites.youtube.selectorGroups.find(g => g.name === groupName);
        if (group) {
            const elements = document.querySelectorAll(group.selector);
            elements.forEach(element => {
                element.classList.toggle('hidden-by-extension', isContentHidden);
            });
            const button = document.querySelector(`.algorithm-escape-toggle-container[data-group="${groupName}"] .algorithm-escape-toggle`);
            updateToggleButton(button);
        }

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
    } else if (currentSite === 'twitter') {
        if (sites.twitter.isNotificationsPage()) {
            return;
        }
        sites.twitter.selectors.forEach(({name, selector}) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.classList.toggle('hidden-by-extension', isContentHidden);
            });
        });
        const button = document.querySelector('.algorithm-escape-toggle-container[data-group="twitter"] .algorithm-escape-toggle');
        updateToggleButton(button);
    } else if (currentSite === 'tiktok') {
        if (sites.tiktok.isAllowedPage()) {
            return;
        }
        sites.tiktok.selectorGroups.forEach(({name, selector}) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = isContentHidden ? 'none' : '';
            });
        });
        const button = document.querySelector('.algorithm-escape-toggle-container[data-group="tiktok-feed"] .algorithm-escape-toggle');
        updateToggleButton(button);
    }
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

function hideYoutubeShorts() {
    const shortsContainer = document.querySelector('ytd-shorts#shorts-container');
    if (shortsContainer) {
        shortsContainer.style.display = 'none';
        if (!document.querySelector('.algorithm-escape-toggle-container[data-group="shorts-feed"]')) {
            createToggleButton(document.body, 'shorts-feed', true);
        }
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
                        if (!element.classList.contains('hidden-by-extension')) {
                            element.classList.add('hidden-by-extension');
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
            shortsShelf.style.display = 'none';
        }
    } else if (currentSite === 'facebook') {
        const newsfeed = sites.facebook.getNewsfeed();
        if (newsfeed && !newsfeed.classList.contains('hidden-by-extension')) {
            newsfeed.classList.add('hidden-by-extension');
            createToggleButton(newsfeed, 'facebook-feed');
        }
    } else if (currentSite === 'instagram') {
        let contentFound = false;
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
        if (sites.twitter.isNotificationsPage()) {
            return;
        }
        let contentFound = false;
        sites.twitter.selectors.forEach(({selector}) => {
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
        if (contentFound && !document.querySelector('.algorithm-escape-toggle-container[data-group="twitter"]')) {
            const mainColumn = document.querySelector('[data-testid="primaryColumn"]');
            if (mainColumn) {
                createToggleButton(mainColumn, 'twitter', true);
            }
        }
    } else if (currentSite === 'tiktok') {
        console.log('Initializing TikTok'); // Debug log
        if (!sites.tiktok.isAllowedPage()) {
            sites.tiktok.selectorGroups.forEach(group => {
                const elements = document.querySelectorAll(group.selector);
                console.log(`Found ${elements.length} elements for selector: ${group.selector}`); // Debug log
                if (elements.length > 0) {
                    elements.forEach(element => {
                        element.style.display = 'none';
                        console.log('Element hidden:', element); // Debug log
                    });
                    if (!document.querySelector('.algorithm-escape-toggle-container[data-group="tiktok-feed"]')) {
                        console.log('Creating toggle button for TikTok'); // Debug log
                        createToggleButton(document.body, 'tiktok-feed', true);
                    }
                }
            });
        }
    }
}

checkSiteEnabled();

const observer = new MutationObserver(() => {
    if (isContentHidden && siteEnabled) {
        handleYoutubeNavigation();
    }
});

observer.observe(document.body, { childList: true, subtree: true });

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

if (getCurrentSite() === 'youtube') {
    window.addEventListener('yt-navigate-finish', handleYoutubeNavigation);
}

function periodicShortsCheck() {
    if (getCurrentSite() === 'youtube') {
        const shortsContainer = document.querySelector('ytd-shorts#shorts-container');
        if (shortsContainer) {
            shortsContainer.style.display = 'none';
        }
        const shortsShelf = document.querySelector('ytd-reel-shelf-renderer');
        if (shortsShelf) {
            shortsShelf.style.display = 'none';
        }
    }
}

// Run the periodic check every second
setInterval(periodicShortsCheck, 1000);

function periodicTikTokCheck() {
    if (getCurrentSite() === 'tiktok' && siteEnabled && isContentHidden) {
        console.log('Periodic TikTok check'); // Debug log
        sites.tiktok.selectorGroups.forEach(group => {
            const elements = document.querySelectorAll(group.selector);
            elements.forEach(element => {
                element.style.display = 'none';
            });
        });
    }
}

// Run the periodic check every second
setInterval(periodicTikTokCheck, 1000);

// Modify the existing interval to include handleYoutubeNavigation
setInterval(() => {
    if (isContentHidden && siteEnabled) {
        initializeSite();
        handleYoutubeNavigation();
    }
}, 1000);

chrome.storage.onChanged.addListener(function(changes, namespace) {
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