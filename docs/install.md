# Install
Detailed install instruction.

Running `npm install` will download all necessary dependencies and then run [postinstall.js](../postinstall.js) which will: 
- create `data/config.local.js` (if not exists)
- create `data/pldr-gallery.sqlite` with demo permissions (if not exists)

## Database

### ⚠ Warning: Currently in development, may not work as expected!

Default database server is used simply file-based sqlite3. 
If you want to use some of _classic_ databases, you have to install database library via NPM.

1. run `npm install <database library>`, eg. `npm install mysql`
1. in `data/config.local.js` update `db.knex` settings, example for mysql:
    ```
    db: {
        knex: {
            client: 'mysql',
            connection: {
                host: '127.0.0.1',
                user: 'pldrgallery',
                password: 'your-password',
                database: 'pldrgallery'
            }
        }
    }
    ```

List of supported database libraries and any other info you can find on [Knex.js page](http://knexjs.org/#Installation-node). 