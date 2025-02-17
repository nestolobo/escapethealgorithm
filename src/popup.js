document.addEventListener("DOMContentLoaded", () => {
  // Get toggle elements for each supported platform
  const toggles = {
    youtube: document.getElementById("youtube-toggle"),
    facebook: document.getElementById("facebook-toggle"),
    instagram: document.getElementById("instagram-toggle"),
    twitter: document.getElementById("twitter-toggle"),
    tiktok: document.getElementById("tiktok-toggle"),
  };

  // Get the "Report Issue" button element
  const reportButton = document.getElementById("report-button");

  /**
   * Load saved settings from chrome.storage and update toggle states.
   * If a setting is not explicitly false, the toggle defaults to checked.
   */
  chrome.storage.sync.get(
    ["youtube", "facebook", "instagram", "twitter", "tiktok"],
    (result) => {
      for (const site in toggles) {
        toggles[site].checked = result[site] !== false;
        toggles[site].setAttribute(
          "aria-checked",
          toggles[site].checked.toString()
        );
      }
    }
  );

  /**
   * Animate the toggle slider to provide visual feedback.
   * @param {HTMLElement} slider - The slider element next to the checkbox.
   * @param {boolean} isChecked - The current checked state of the toggle.
   */
  const animateSlider = (slider, isChecked) => {
    slider.style.transition = "background-color 0.3s, transform 0.3s";
    slider.style.transform = isChecked ? "scale(1.1)" : "scale(0.9)";
    setTimeout(() => {
      slider.style.transform = "scale(1)";
    }, 150);
  };

  /**
   * Listen for changes on each toggle:
   * - Save the new state to chrome.storage.
   * - Update the aria-checked attribute for accessibility.
   * - Animate the slider for visual feedback.
   */
  for (const site in toggles) {
    toggles[site].addEventListener("change", function () {
      chrome.storage.sync.set({ [site]: this.checked });
      this.setAttribute("aria-checked", this.checked.toString());
      const slider = this.nextElementSibling;
      if (slider) {
        animateSlider(slider, this.checked);
      }
    });
  }

  /**
   * Open the default email client to report an issue when the report button is clicked.
   */
  reportButton.addEventListener("click", () => {
    const emailAddress = "glitchfix@escapethealgorithm.org";
    const subject = "Issue Report: Escape the Algorithm Extension";
    const body = "Please describe the issue you encountered:";
    const mailtoLink = `mailto:${emailAddress}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    chrome.tabs.create({ url: mailtoLink });
  });

  /**
   * Add hover animations to the report button for enhanced user feedback.
   */
  reportButton.addEventListener("mouseover", function () {
    this.style.transform = "translateY(-2px) rotate(2deg)";
  });
  reportButton.addEventListener("mouseout", function () {
    this.style.transform = "translateY(0) rotate(0deg)";
  });
});
