# Docker
Docker is fully supported, yay!

`docker stop <your container>` will gracefully end everything and stop server by itself.

## Production 
### Build 
```
docker build \
 -t djtommek/pldr-gallery:master \ 
 https://github.com/DJTommek/pldr-gallery.git
```
### Run
```
docker run \
 -d \
 --name pldr-gallery-production \
 -p 3000:3000 \
 -v /var/www/nodejs/pldr-gallery/production/docker-data/:/app/data \
 -v /srv/photos/:/app/demo \
 --restart unless-stopped \
 djtommek/pldr-gallery:master
```
Notes:
- mounting `data/` folder to your local machine is not necessary, but it allow you to easily manage local config and view logs
    - if you do so, don't forget to create local config in `/var/www/nodejs/pldr-gallery/production/docker/data/config.local.js` 
- don't forget to mount your photos, videos, etc. (in production example it is in `/srv/photos`) 
- if you are using HTTPS server, don't forget to expose both ports: `-p 3000-3001:3000-3001` or whatever is in your local config

## Development
Using development branch
### Build 
```
docker build \
 -t djtommek/pldr-gallery:development 
 https://github.com/DJTommek/pldr-gallery.git:development
```
### Run
```
docker run \
 -d \
 --name pldr-gallery-development \
 -p 3005:3000 \
 -v /var/www/nodejs/pldr-gallery/development/docker-data/:/app/data \
 djtommek/pldr-gallery:development
```
