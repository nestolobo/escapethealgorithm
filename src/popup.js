document.addEventListener("DOMContentLoaded", function () {
  const toggles = {
    youtube: document.getElementById("youtube-toggle"),
    facebook: document.getElementById("facebook-toggle"),
    instagram: document.getElementById("instagram-toggle"),
    twitter: document.getElementById("twitter-toggle"),
    tiktok: document.getElementById("tiktok-toggle"),
  };

  const reportButton = document.getElementById("report-button");

  // Load saved settings
  chrome.storage.sync.get(
    ["youtube", "facebook", "instagram", "twitter", "tiktok"],
    function (result) {
      for (let site in toggles) {
        toggles[site].checked = result[site] !== false;
      }
    }
  );

  // Save settings when toggled and add animation
  for (let site in toggles) {
    toggles[site].addEventListener("change", function () {
      chrome.storage.sync.set({ [site]: this.checked });

      // Animation
      const slider = this.nextElementSibling;
      slider.style.transition = "background-color 0.3s, transform 0.3s";

      if (this.checked) {
        slider.style.transform = "scale(1.1)";
        setTimeout(() => {
          slider.style.transform = "scale(1)";
        }, 150);
      } else {
        slider.style.transform = "scale(0.9)";
        setTimeout(() => {
          slider.style.transform = "scale(1)";
        }, 150);
      }
    });
  }

  // Report Issue button functionality
  reportButton.addEventListener("click", function () {
    const emailAddress = "glitchfix@escapethealgorithm.org";
    const subject = "Issue Report: Escape the Algorithm Extension";
    const body = "Please describe the issue you encountered:";

    const mailtoLink = `mailto:${emailAddress}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    chrome.tabs.create({ url: mailtoLink });
  });

  // Button hover animation
  reportButton.addEventListener("mouseover", function () {
    this.style.transform = "translateY(-2px) rotate(2deg)";
  });

  reportButton.addEventListener("mouseout", function () {
    this.style.transform = "translateY(0) rotate(0deg)";
  });
});
