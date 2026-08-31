# Changelog

## [1.0.31] - 2026-08-30
### Fixed
- YouTube subscriptions page appearing empty after navigating back from a video. YouTube's SPA keeps visited pages cached in the DOM, and the extension was hiding the cached subscriptions grid while on non-allowed pages. Cached (hidden) pages are now skipped when hiding, and allowed pages actively un-hide their feed on arrival.

## [1.0.30] - 2026-05-25
### Added
- Safari build target (macOS + iOS/iPadOS). Run `npm run build:safari` to produce `build/safari/` and `safari_addon.zip`.

### Wrapping for Safari
The Safari build output is a standard Web Extension folder. Wrap it in a native Safari app shell with Xcode's converter:
```
xcrun safari-web-extension-converter ./build/safari
```
Xcode is required. The converter generates an Xcode project with both macOS and iOS targets — build & run from Xcode, then enable the extension in Safari → Settings → Extensions.

## [1.0.29] - 2026-05-25
### Added
- LinkedIn feed blocking support
- Pinterest feed blocking support
- 10-minute countdown timer that automatically re-hides the feed after temporarily showing it
- Hardcore mode for stricter feed blocking
### Changed
- Updated webpack to 5.105.0 and other dependencies for security patches
### Fixed
- Incomplete URL substring sanitization (CodeQL alert #12)
- Duplicate dependency entries in package.json

## [1.0.28] - 2026-02-08
### Added
- Hardcore mode
### Changed
- Removed sparkle animation

## [1.0.25] - 2023-09-13
### Added
- X button to remove the show/hide button from the page temporarily in case it is in the way of basic site functionality

## [1.0.24] - 2023-07-27
### Added
- New feature to block TikTok feeds
### Changed
- Improved YouTube feed detection algorithm
### Fixed
- Bug in Twitter feed blocking

## [1.0.23] - 2023-07-20
### Added
- Support for Instagram Reels
### Changed
- Updated UI for better user experience