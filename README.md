# pldrGallery
Standalone Node.js Express application for nice and quick browsing of your multimedia files.

## Live demo
https://pldr-gallery.redilap.cz/

This exact demo is included in the source code, just follow Installation instructions.

## Requirements
Installed **Node.js 12.14.1+**  
Note: it should work with version 10, but some functions such as searching might not work as expected.

## Installation
1. Clone [DJTommek/pldr-gallery](https://github.com/DJTommek/pldr-gallery) repository
1. Run `npm install`
1. Run `node index.js`
1. Open http://localhost:3000/

Detailed info about installation you can find on [install page](docs/install.md).<br>
[Docker](https://docker.io/) is fully supported, see [this page](docs/docker.md) for more info.

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
2. Run `npm test`  

### Note
Integrations tests (currently only `test/webserver.js` are using real config file and expecting default values so it might fail for your run. 
Recommended to run tests after clean install. 

Also application should be offline - integration tests will start it's own server instance on port defined in config.


