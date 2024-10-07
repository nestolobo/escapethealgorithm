# Escape the Algorithm - Social Media Feed Blocker

## Overview

Escape the Algorithm is a browser extension designed to hide distracting feeds and suggested content on popular social media platforms like YouTube, Twitter, Facebook, and more. It aims to help users break free from social media addiction by giving them control over what content they see.

## Features

- Blocks feeds on multiple platforms: YouTube, Twitter, Facebook, Instagram, and TikTok
- Customizable blocking options for each platform
- Toggle button to show/hide content as needed
- Autoplay disabling for YouTube videos

## Build Instructions

### Requirements

- Operating System: macOS, Linux, or Windows
- Node.js version 14.x or later
- npm version 6.x or later

### Installation

1. Install Node.js and npm from [https://nodejs.org/](https://nodejs.org/)
2. Clone the repository or extract the source code to a local directory

### Build Process

1. Open a terminal and navigate to the project directory
2. Install dependencies:
   ```
   npm install
   ```
3. Build the extension for Firefox:
   ```
   npm run build:firefox
   ```
   This command will:
   - Compile the JavaScript files using webpack
   - Merge the manifest files
   - Create a zip file named `firefox_addon.zip` in the project root directory

### Build Script

The build process is automated using npm scripts defined in `package.json`:

```json
"scripts": {
  "build:firefox": "webpack --env browser=firefox && node mergeManifests.js firefox"
}
```

This script runs webpack with the Firefox environment and then executes the `mergeManifests.js` script to create the final build.

## Project Structure

- `src/`: Contains the main source files
  - `content.js`: Content script for blocking feeds
  - `background.js`: Background script for extension functionality
  - `popup.html` and `popup.js`: Extension popup interface
  - `styles.css`: Styles for the extension
- `platform_specific/`: Contains browser-specific manifest files
- `webpack.config.js`: Webpack configuration
- `mergeManifests.js`: Script to merge manifest files and create the final build

## Development

To develop or modify the extension:

1. Make changes to the files in the `src/` directory
2. Run `npm run build:firefox` to create a new build
3. Load the extension in Firefox for testing (see Testing section)

## Testing

To test the extension in Firefox:

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Navigate to your project directory and select the `manifest.json` file in the `build/firefox/` directory

## Notes for Reviewers

- This extension uses webpack for bundling and a custom script (`mergeManifests.js`) for merging manifests.
- The build process generates source maps to aid in code review.
- The extension operates by injecting CSS and JavaScript into the specified social media sites to hide feed elements.
- We use the `webextension-polyfill` library to ensure cross-browser compatibility between Chrome and Firefox.
- The `content.js` file contains site-specific selectors and logic for hiding content on different platforms.
- Privacy Consideration: This extension does not collect or transmit any user data. All operations are performed locally in the user's browser.

If you encounter any issues during the review process or need additional information, please don't hesitate to reach out.

## License

MIT License

Copyright (c) 2024 Ernest Wolfe

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Contact

I can be contacted at ernest@escapethealgorithm.org