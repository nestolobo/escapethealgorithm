import browser from "webextension-polyfill";

const SUPPORTED_DOMAINS = [
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "pinterest.com",
  "linkedin.com",
  "reddit.com",
];

// Match on the parsed hostname, not a substring of the URL, so that
// e.g. "https://example.com/?reddit.com" doesn't count as Reddit
function isSupportedSite(url) {
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  return SUPPORTED_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    if (isSupportedSite(tab.url)) {
      browser.tabs
        .sendMessage(tabId, { action: "pageChanged" })
        .catch((error) => {
          console.log("Error sending message:", error);
          // Content script is not ready yet, wait and try again
          setTimeout(() => {
            browser.tabs
              .sendMessage(tabId, { action: "pageChanged" })
              .catch(console.error);
          }, 1000);
        });
    }
  }
});

browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    browser.tabs.create({
      url: "https://escapethealgorithm.org/welcome.html",
    });

    browser.notifications
      .create({
        type: "basic",
        iconUrl: browser.runtime.getURL("icons/icon128.png"),
        title: "Pin Escape the Algorithm",
        message: "For easy access, pin our extension to your toolbar!",
        priority: 2,
      })
      .catch((error) => console.error("Notification error: ", error));
  }

  if (details.reason === "update") {
    const currentVersion = browser.runtime.getManifest().version;
    const updateUrl = `https://escapethealgorithm.org/changelog.html`;
    browser.tabs.create({ url: updateUrl });
  }
});
