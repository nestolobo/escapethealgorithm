chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.includes('youtube.com') || 
            tab.url.includes('facebook.com') || 
            tab.url.includes('instagram.com') || 
            tab.url.includes('twitter.com') || 
            tab.url.includes('x.com')) {
            chrome.tabs.sendMessage(tabId, { action: 'pageChanged' });
        }
    }
});