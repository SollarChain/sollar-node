
const logger = new (require(global.PATH.mainDir + '/modules/logger'))("IZ3 Postgres DB plugin");
const { Client } = require('pg');
let pluginStorj = null;
const BigNumber = require('bignumber.js');


class PGDatabase {
    db = null;
    path = '';

    constructor(path, cb) {
        this.config = pluginStorj.get('config');
        this.path = path;
        
        this.init(cb);
    }

    async init(cb) {
        const client = new Client(this.config.dbConfig);
        client.connect(err => {
            if (err) {
                logger.error(`Connection error`);
                console.log(err);
                return;
            }
            
            this.db = client;
            // this.addAggregateFunctions();
            this.attachDataBase(() => {
                this.createTable(cb);
            })
        });
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
        this.db.query(`
            DROP TABLE IF EXISTS "events";
        `, (err) => {
            cb();
        })

        // this.db.query(`
        //     ATTACH DATABASE "${this.path}" as flush_db; 
        //     DROP TABLE IF EXISTS main."events";
        //     CREATE TABLE main."events" AS SELECT * FROM flush_db."events";
        //     DETACH DATABASE flush_db;
        // `, (err) => {
        //     // if database loaded with error, DEATACH IT
        //     if (err) {
        //         console.log('attachDataBase', err);
        //         this.db.query(`DETACH DATABASE flush_db;`, (err) => {
        //             cb();
        //         })
        //     } else {
        //         cb();
        //     }
        // })
    }

    createTable(cb) {
        this.db.query(`
            CREATE TABLE IF NOT EXISTS "events" (
                "id" SERIAL,
                "event" VARCHAR(50) NOT NULL,
                "contract" INTEGER NOT NULL,
                "timestamp" VARCHAR(14),
                "block" INTEGER,
                "hash" VARCHAR(200),
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
            this.db.query(`CREATE INDEX IF NOT EXISTS index_block_contract ON events (contract, block);`, (err2) => {
                cb(err1 || err2);
            });
        })
    }

    raw(sql, cb) {
        this.db.query(sql, (err, res) => {
            if (err) {
                cb(err);
                return;
            }
            
            cb(null, res.rows);
        })
    }

    exec(sql, cb) {
        return this.raw(sql, cb);
    }

    run(sql, cb) {
        return this.raw(sql, cb);
    }

    all(sql, cb) {
        return this.raw(sql, cb);
    }

    flush(cb) {
        cb();
    }
}


module.exports = function register(blockchain, config, storj) {
    logger.info('Initialize Database');
    
    pluginStorj = storj;
    storj.put('DefaultDB', PGDatabase);
    
    logger.info('OK');
};
