# pldrGallery

Standalone Node.js Express application for nice and quick browsing of your multimedia files.

## Live demo

https://pldr-gallery.redilap.cz/

This exact demo is included in the source code, just follow Installation instructions.

## Requirements

- Node.js (currently developed with Node.js 16.13.1)
- MySQL / MariaDB (currently developed with MariaDB 10.6.5)

It might work with little bit older versions, try it.

### Optional
- [ffmpeg](https://ffmpeg.org/) (more precisely just [ffprobe](https://ffmpeg.org/ffprobe.html)) for reading coordinates from video files

## Installation

1. Clone [DJTommek/pldr-gallery](https://github.com/DJTommek/pldr-gallery) repository

2. Run `npm install`

3. Run `node src/bin/prepare-config.js` to generate local config `data/config.local.js`.
	 
	Update all necessary details (most importantly `config.db.knex.connection.*`)

6. Run `node src/bin/prepare-db.js` to create all required tables. Add argument `--help` for more info.
	
7. Run `node index.js`

8. Open http://localhost:3000/

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
- Show folder images as thumbnails
- Download all/some files and/or folders as ZIP
- And much more...

## Testing

1. Install development dependencies via `npm install`

2. Run `npm test`

### Note

Integrations tests (currently only `test/webserver.js` are using real config file and expecting default values so it might fail for your run. Recommended to run tests after clean install.

Also application should be offline - integration tests will start it's own server instance on port defined in config.


