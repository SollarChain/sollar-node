
const logger = new (require(global.PATH.mainDir + '/modules/logger'))("IZ3 Sqlite3 plugin");
const sqlite3 = require('sqlite3').verbose();
let pluginStorj = null;
const BigNumber = require('bignumber.js');


class Sqlite3Database {
    db = null;
    path = '';

    constructor(path, cb) {
        this.config = pluginStorj.get('config');
        this.path = path;
        
        this.init(cb);
    }

    init(cb) {
        this.db = new sqlite3.Database(this.path, () => {
            this.addAggregateFunctions();
            this.attachDataBase(() => {
                this.createTable(cb);
            })
        })
    }

    /**
     * BigNumber sum
     */
    addAggregateFunctions() {
        let sum = new BigNumber(0);
        try {
            this.db.registerAggregateFunction('bsum', (value) => {
                if (!value) {
                    const returnVal = sum.toFixed();
                    sum = new BigNumber(0);
                    return returnVal;
                }

                value = new BigNumber(value);

                if (!value.isNaN()) {
                    sum = sum.plus(value);
                }
            })
        } catch (e) {
            logger.warning('Aggregate functions unsupported for current SQLite3 module');
        }
    }

    attachDataBase(cb) {
        this.db.exec(`
            ATTACH DATABASE "${this.path}" as flush_db; 
            DROP TABLE IF EXISTS main.\`events\`;
            CREATE TABLE main.\`events\` AS SELECT * FROM flush_db.\`events\`;
            DETACH DATABASE flush_db;
        `, (err) => {
            // if database loaded with error, DEATACH IT
            if (err) {
                this.db.exec(`DETACH DATABASE flush_db;`, (err) => {
                    cb();
                })
            } else {
                cb();
            }
        })
    }

    createTable(cb) {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS "events" (
                "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                "event" TEXT NOT NULL,
                "contract" INTEGER NOT NULL,
                "timestamp" TEXT,
                "block" INTEGER,
                "hash" TEXT,
                "v1" TEXT,
                "v2" TEXT,
                "v3" TEXT,
                "v4" TEXT,
                "v5" TEXT,
                "v6" TEXT,
                "v7" TEXT,
                "v8" TEXT,
                "v9" TEXT,
                "v10" TEXT
            );
        `, (err1) => {
            this.db.exec(`CREATE INDEX IF NOT EXISTS index_block_contract ON events (contract, block);`, (err2) => {
                cb(err1 || err2);
            });
        })
    }

    exec(sql, cb) {
        return this.db.exec(sql, cb);
    }

    run(sql, cb) {
        return this.db.run(sql, cb);
    }

    all(sql, cb) {
        return this.db.all(sql, cb);
    }

    flush(cb) {
        this.db.exec(`
            ATTACH DATABASE "${this.path}" AS flush_db; 
            DROP TABLE IF EXISTS flush_db."events"; 
            CREATE TABLE flush_db."events" AS SELECT * FROM main."events"; 
            DETACH DATABASE flush_db;
        `, (err) => {
            // if database loaded with error, DEATACH IT
            if (err) {
                this.db.exec("DETACH DATABASE flush_db;", (err2) => {
                    cb(err);
                });
            } else {
                cb(err);
            }
        });
    }
}


module.exports = function register(blockchain, config, storj) {
    logger.info('Initialize Database');
    
    pluginStorj = storj;
    storj.put('DefaultDB', Sqlite3Database);
    
    logger.info('OK');
};
