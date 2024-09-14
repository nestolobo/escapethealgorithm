chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.includes('youtube.com') || 
            tab.url.includes('facebook.com') || 
            tab.url.includes('instagram.com') || 
            tab.url.includes('twitter.com') || 
            tab.url.includes('x.com') ||
            tab.url.includes('tiktok.com')) {
            chrome.tabs.sendMessage(tabId, { action: 'pageChanged' }, (response) => {
                if (chrome.runtime.lastError) {
                    // Content script is not ready yet, wait and try again
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tabId, { action: 'pageChanged' });
                    }, 1000);
                }
            });
        }
    }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({
      url: "https://escapethealgorithm.org/welcome.html"
    });
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'Pin Escape the Algorithm',
      message: 'For easy access, pin our extension to your toolbar!',
      priority: 2
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.error("Notification error: ", chrome.runtime.lastError.message);
      }
    });
  }
    if (details.reason === "update") {
    const currentVersion = chrome.runtime.getManifest().version;
    const updateUrl = `https://escapethealgorithm.org/changelog.html`;
    chrome.tabs.create({ url: updateUrl });
  }
});
