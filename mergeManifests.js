const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

function mergeManifests(browser) {
  const baseManifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, "src", "manifest.json"), "utf8")
  );
  const browserManifest = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "platform_specific", browser, "manifest.json"),
      "utf8"
    )
  );

  let mergedManifest = { ...baseManifest, ...browserManifest };

  // Handle browser-specific adjustments
  if (browser === "firefox") {
    if (mergedManifest.host_permissions) {
      mergedManifest.permissions = [
        ...(mergedManifest.permissions || []),
        ...mergedManifest.host_permissions,
      ];
      delete mergedManifest.host_permissions;
    }
    if (mergedManifest.action) {
      mergedManifest.browser_action = mergedManifest.action;
      delete mergedManifest.action;
    }
  }

  fs.writeFileSync(
    path.join(__dirname, "build", browser, "manifest.json"),
    JSON.stringify(mergedManifest, null, 2)
  );

  if (browser === "firefox") {
    fs.copyFileSync(
      path.join(
        __dirname,
        "node_modules",
        "webextension-polyfill",
        "dist",
        "browser-polyfill.js"
      ),
      path.join(__dirname, "build", browser, "browser-polyfill.js")
    );
  }

  if (browser === "safari") {
    fs.copyFileSync(
      path.join(
        __dirname,
        "node_modules",
        "webextension-polyfill",
        "dist",
        "browser-polyfill.js"
      ),
      path.join(__dirname, "build", browser, "browser-polyfill.js")
    );

    const popupHtmlPath = path.join(__dirname, "build", browser, "popup.html");
    const popupHtml = fs.readFileSync(popupHtmlPath, "utf8");
    const injected = popupHtml.replace(
      '<script src="popup.js"></script>',
      '<script src="browser-polyfill.js"></script>\n    <script>if(typeof chrome==="undefined"){var chrome=browser;}</script>\n    <script src="popup.js"></script>'
    );
    fs.writeFileSync(popupHtmlPath, injected);
  }

  createZip(browser);
}

function createZip(browser) {
  const output = fs.createWriteStream(
    path.join(__dirname, `${browser}_addon.zip`)
  );
  const archive = archiver("zip", {
    zlib: { level: 9 },
  });

  output.on("close", function () {
    console.log(archive.pointer() + " total bytes");
    console.log(
      "Archiver has been finalized and the output file descriptor has closed."
    );
  });

  archive.on("error", function (err) {
    throw err;
  });

  archive.pipe(output);

  const buildDir = path.join(__dirname, "build", browser);

  archive.glob("**/*", {
    cwd: buildDir,
    ignore: [".DS_Store", "**/.DS_Store", "__MACOSX"],
  });

  archive.finalize();
}

mergeManifests(process.argv[2]); // Pass 'chrome' or 'firefox' as an argument
