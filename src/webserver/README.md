Webserver

All endpoints are loaded recursively from folder `pages` and all 
should generated automatically based on their path.
Example:
```
/webserver
|- /webserver.js - main file starting server
|- /pages/ - all *.js files will be loaded  
   |- /api.js - load all *.js files from folder "api" and create endpoint /api/
   |- /api/ - all *.js files will be loaded
      |- ping.js - for example /api/ping 
      |- structure.js
      ...
```