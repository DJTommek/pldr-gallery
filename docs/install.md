# Install
Detailed install instruction.

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

List of database libraries and any other info you can find on [Knex.js page](http://knexjs.org/#Installation-node). 