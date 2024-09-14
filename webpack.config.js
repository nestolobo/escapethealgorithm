const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const browser = env.browser || 'chrome';

  return {
    entry: {
      background: './src/background.js',
      content: './src/content.js',
      popup: './src/popup.js',
    },
    output: {
      path: path.resolve(__dirname, 'build', browser),
      filename: '[name].js',
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: `platform_specific/${browser}/manifest.json` },
          { from: 'src/popup.html' },
          { from: 'src/styles.css' },
          { from: 'src/icons', to: 'icons' },
        ],
      }),
    ],
  };
};