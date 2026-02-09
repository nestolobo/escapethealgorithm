document.addEventListener("DOMContentLoaded", () => {
  // Cache references to the toggle elements for social media platforms.
  const toggles = {
    youtube: document.getElementById("youtube-toggle"),
    facebook: document.getElementById("facebook-toggle"),
    instagram: document.getElementById("instagram-toggle"),
    twitter: document.getElementById("twitter-toggle"),
    tiktok: document.getElementById("tiktok-toggle"),
    hardcore: document.getElementById("hardcore-toggle"),
  };

  // Cache reference to the "Report Issue" button.
  const reportButton = document.getElementById("report-button");

  // Cache reference to the theme toggle element (assumes it's added in popup.html).
  const themeToggle = document.getElementById("theme-toggle");

  /**
   * Applies the specified theme by setting CSS classes on the document body.
   * @param {string} theme - "dark" or "light".
   */
  const applyTheme = (theme) => {
    if (theme === "dark") {
      document.body.classList.add("dark-theme");
      document.body.classList.remove("light-theme");
    } else {
      document.body.classList.add("light-theme");
      document.body.classList.remove("dark-theme");
    }
  };

  /**
   * Saves a setting to chrome.storage.sync with error handling.
   * @param {string} key - The storage key.
   * @param {any} value - The value to save.
   */
  const saveSetting = (key, value) => {
    const setting = {};
    setting[key] = value;
    chrome.storage.sync.set(setting, () => {
      if (chrome.runtime.lastError) {
        console.error(
          `Error saving ${key} setting:`,
          chrome.runtime.lastError.message
        );
      }
    });
  };

  /**
   * Animates the slider element for visual feedback on toggle change.
   * @param {HTMLElement} slider - The slider element adjacent to the checkbox.
   * @param {boolean} isChecked - The new state of the toggle.
   */
  const animateSlider = (slider, isChecked) => {
    slider.style.transition = "background-color 0.3s, transform 0.3s";
    slider.style.transform = isChecked ? "scale(1.1)" : "scale(0.9)";
    setTimeout(() => {
      slider.style.transform = "scale(1)";
    }, 150);
  };

  /**
   * Loads saved settings from chrome.storage.sync and updates the UI.
   */
  const loadSettings = () => {
    chrome.storage.sync.get(
      ["youtube", "facebook", "instagram", "twitter", "tiktok", "hardcore", "theme"],
      (result) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error loading settings:",
            chrome.runtime.lastError.message
          );
          return;
        }
        // Update social media toggles (default to true/checked).
        for (const site in toggles) {
          if (site === "hardcore") continue; // Handle hardcore separately
          const isChecked = result[site] !== false;
          toggles[site].checked = isChecked;
          toggles[site].setAttribute("aria-checked", isChecked.toString());
        }
        // Hardcore mode defaults to false/unchecked.
        const hardcoreEnabled = result.hardcore === true;
        toggles.hardcore.checked = hardcoreEnabled;
        toggles.hardcore.setAttribute("aria-checked", hardcoreEnabled.toString());
        // Load theme setting, or default to system preference.
        let theme = result.theme;
        if (!theme) {
          theme = window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
        }
        applyTheme(theme);
        if (themeToggle) {
          themeToggle.checked = theme === "dark";
          themeToggle.setAttribute(
            "aria-checked",
            themeToggle.checked.toString()
          );
        }
      }
    );
  };

  // Initialize settings on load.
  loadSettings();

  // Add change event listeners for each social media toggle.
  for (const site in toggles) {
    toggles[site].addEventListener("change", function () {
      const isChecked = this.checked;
      saveSetting(site, isChecked);
      this.setAttribute("aria-checked", isChecked.toString());
      const slider = this.nextElementSibling;
      if (slider) {
        animateSlider(slider, isChecked);
      }
    });
  }

  // Add change event listener for the theme toggle if it exists.
  if (themeToggle) {
    themeToggle.addEventListener("change", function () {
      const newTheme = this.checked ? "dark" : "light";
      applyTheme(newTheme);
      this.setAttribute("aria-checked", this.checked.toString());
      saveSetting("theme", newTheme);
    });
  }

  /**
   * Opens the user's default email client to report an issue.
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

  // Add hover animations for the report button.
  reportButton.addEventListener("mouseover", function () {
    this.style.transform = "translateY(-2px) rotate(2deg)";
  });
  reportButton.addEventListener("mouseout", function () {
    this.style.transform = "translateY(0) rotate(0deg)";
  });
});
