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
        isChannelVideosPage: function() {
            return window.location.pathname.includes('/videos');
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
    }
};

function createToggleButton(element, groupName, fixed = false) {
    let container = document.querySelector(`.algorithm-escape-toggle-container[data-group="${groupName}"]`);
    if (container) return container.querySelector('.algorithm-escape-toggle');

    container = document.createElement('div');
    container.className = 'algorithm-escape-toggle-container';
    container.setAttribute('data-group', groupName);

    if (fixed) {
        container.style.position = 'absolute';
        container.style.top = '50%';
        container.style.left = '50%';
        container.style.transform = 'translate(-50%, -50%)';
        container.style.zIndex = '9999';
    }

    const button = document.createElement('button');
    button.className = 'algorithm-escape-toggle';
    button.textContent = 'Show Hidden Content';

    const text = document.createElement('p');
    text.className = 'algorithm-escape-text';
    text.textContent = 'You are escaping the algorithm 😎';

    container.appendChild(button);
    container.appendChild(text);

    if (fixed) {
        element.appendChild(container);
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
    return null;
}

function hideOrShowContent(groupName) {
    const currentSite = getCurrentSite();
    if (currentSite === 'youtube') {
        if (sites.youtube.isChannelVideosPage()) {
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
    }
    
    const buttons = document.querySelectorAll('.algorithm-escape-toggle-container');
    buttons.forEach(button => button.remove());
}

function initializeSite() {
    if (!siteEnabled) return;
    
    const currentSite = getCurrentSite();
    if (currentSite === 'youtube') {
        if (sites.youtube.isChannelVideosPage()) {
            return;
        }
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
    }
}

checkSiteEnabled();

const observer = new MutationObserver(() => {
    if (isContentHidden && siteEnabled) {
        initializeSite();
    }
});

observer.observe(document.body, { childList: true, subtree: true });

setInterval(() => {
    if (isContentHidden && siteEnabled) {
        initializeSite();
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