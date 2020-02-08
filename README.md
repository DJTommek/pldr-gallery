# pldrGallery
Standalone Node.js Express application for nice and quick browsing of your multimedia files.

## Live demo
http://gallery.redilap.cz/#/demo/

This exact demo is included in the source code, just follow Installation instructions.

## Installation
1. Clone repository
1. Run `npm install`
1. Rename `libs/config.local.example.js` to `libs/config.local.js` (optional: edit default values)
1. Run `node index.js`
1. Open http://localhost:3000/

## Requirements
Installed **Node.js 12.14.1+**

Note: it should work with older versions (8, 10), but some functions such as searching might not work as expected.

## Features
- Fast browsing of folders and files on your hard drive without any need to reload the page
- Image, video and audio is fully supported thanks to HML5. Other files can be downloaded directly
- Support for Google login and shareable links (passwords)
- Optional HTTPS support
- Even if you know URL to a file or a folder, you will not access it unless you have permission.
- Permissions are set individually for each folder or file, and can be customized as needed
- Data saver to run even on slow internet connection (server upload or client download)
- Relax with presentation mode
- Show images on map based on EXIF data
- Save your eyes with dark theme
- Use keyboard for almost everything
- And much more...

## Testing
1. Install development dependencies via `npm install`
1. Run `npm test`


