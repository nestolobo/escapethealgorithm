const fs = require('fs');
const path = require('path');

function mergeManifests(browser) {
  const baseManifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'manifest.json'), 'utf8'));
  const browserManifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'platform_specific', browser, 'manifest.json'), 'utf8'));

  const mergedManifest = { ...baseManifest, ...browserManifest };

  fs.writeFileSync(path.join(__dirname, 'build', browser, 'manifest.json'), JSON.stringify(mergedManifest, null, 2));
}

mergeManifests(process.argv[2]); // Pass 'chrome' or 'firefox' as an argument