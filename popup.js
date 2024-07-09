document.addEventListener('DOMContentLoaded', function() {
  const youtubeToggle = document.getElementById('youtube-toggle');
  const facebookToggle = document.getElementById('facebook-toggle');
  const instagramToggle = document.getElementById('instagram-toggle');
  const twitterToggle = document.getElementById('twitter-toggle');
  const tiktokToggle = document.getElementById('tiktok-toggle');

  // Load saved settings
  chrome.storage.sync.get(['youtube', 'facebook', 'instagram', 'twitter', 'tiktok'], function(result) {
    youtubeToggle.checked = result.youtube !== false;
    facebookToggle.checked = result.facebook !== false;
    instagramToggle.checked = result.instagram !== false;
    twitterToggle.checked = result.twitter !== false;
    tiktokToggle.checked = result.tiktok !== false;
  });

  // Save settings when toggled
  youtubeToggle.addEventListener('change', function() {
    chrome.storage.sync.set({youtube: this.checked});
  });

  facebookToggle.addEventListener('change', function() {
    chrome.storage.sync.set({facebook: this.checked});
  });

  instagramToggle.addEventListener('change', function() {
    chrome.storage.sync.set({instagram: this.checked});
  });

  twitterToggle.addEventListener('change', function() {
    chrome.storage.sync.set({twitter: this.checked});
  });

  tiktokToggle.addEventListener('change', function() {
    chrome.storage.sync.set({tiktok: this.checked});
  });
});