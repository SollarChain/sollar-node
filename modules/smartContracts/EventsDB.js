/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */


const logger = new (require('../logger'))('ContractEvents');
const storj = require('../instanceStorage');

/**
 * Events index database
 */
class EventsDB {
    constructor(path) {
        this.config = storj.get('config');

        if (path === '' || path === ':memory:') {
            this.path = path;
        } else {
            this.path = this.config.workDir + path; // '/contractsRuntime/EventsDB.db';
        }

        this.db = null;
        this._eventHandler = {};
        this._transactions = {};

        storj.put('ContractEvents', this);
    }

    /**
     * Initialize DB
     * @param cb
     */
    initialize(cb) {
        const DefaultDB = storj.get('DefaultDB');
        this.db = new DefaultDB(this.path, cb);
    }

    /**
     * Flush DB to disk
     * @param {Function} cb
     */
    flush(cb) {
        if (this.path === '' || this.path === ':memory:') {
            cb(null);
            return;
        }

        this.db.flush(cb);
    }

    /**
     * Handle block replayed
     * @param blockIndex
     * @param cb
     * @private
     */
    _handleBlockReplay(blockIndex, cb) {
        this.db.run(`
            DELETE FROM "events" 
            WHERE block >= ${blockIndex}
        `, (err) => {
            cb(err);
        });
    }

    /**
     * Handle event emit
     * TODO: Change to transactional variant
     * @param contract
     * @param event
     * @param {array} params
     * @param block
     * @param cb
     */
    event(contract, event, params, block, cb) {
        let that = this;
        this._insertEvent(contract, event, params, block, function (err) {
            /* that._handleEvent(contract, event, params, function () {
                 cb(err);
             })*/
            cb(err);
        });
    }

    /**
     * Rollback block contract Events
     * TODO: Change to transactional variant
     * @param contract
     * @param block
     * @param cb
     */
    rollback(contract, block, cb) {
        this.db.run(`
            DELETE FROM "events" 
            WHERE block = ${block} 
            AND contract = '${contract}'
        `, function (err) {
            cb(err);
        });
    }

    /**
     * Deploy block contract Events
     * TODO: Change to transactional variant
     * @param contract
     * @param block
     * @param cb
     */
    async deploy(contract, block, cb) {
        function dbRowToParamsArray(row) {
            let params = [];
            params.push(row.v1);
            params.push(row.v2);
            params.push(row.v3);
            params.push(row.v4);
            params.push(row.v5);
            params.push(row.v6);
            params.push(row.v7);
            params.push(row.v8);
            params.push(row.v9);
            params.push(row.v10);
            return params;
        }

        this.db.all(`
            SELECT * FROM "events" 
            WHERE block = ${block} AND contract = '${contract}'
        `, async (err, values) => {
            if (err) {
                cb(err);
            } else {
                for (let a in values) {
                    if (values.hasOwnProperty(a)) {
                        await (new Promise(resolve => {
                            this._handleEvent(contract, values[a].event, dbRowToParamsArray(values[a]), function () {
                                resolve();
                            })
                        }));
                    }

                }

                cb(null);
            }
        });
    }

    /**
     * Insert event to index
     * @param contract
     * @param event
     * @param params
     * @param block
     * @param cb
     * @private
     */
    _insertEvent(contract, event, params, block, cb) {
        for (let i = params.length + 1; i <= 10; i++) {
            params.push(null);
        }

        const v1 = params[0];
        const v2 = params[1];
        const v3 = params[2];
        const v4 = params[3];
        const v5 = params[4];
        const v6 = params[5];
        const v7 = params[6];
        const v8 = params[7];
        const v9 = params[8];
        const v10 = params[9];
        
        this.db.run(`
            INSERT INTO "events" (
                "v1", "v2", "v3",
                "v4", "v5", "v6",
                "v7", "v8", "v9",
                "v10", 
                "event",
                "contract",
                "timestamp", 
                "block", 
                "hash"
            ) VALUES (
                '${v1}', '${v2}', '${v3}',
                '${v4}', '${v5}', '${v6}',
                '${v7}', '${v8}', '${v9}',
                '${v10}', 
                '${event}',
                ${contract},
                '${block.timestamp}',
                ${block.index},
                '${block.hash}'
            )
        `, (err) => {
            cb(err);
        })

        // let statement = this.db.prepare("INSERT INTO `events` (`v1`,`v2`,`v3`,`v4`,`v5`,`v6`,`v7`,`v8`,`v9`,`v10`,`event`,`contract`, `timestamp`, `block`, `hash`) " +
        //     "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", params, function (err) {
        //     if (err) {
        //         cb(err);
        //         return;
        //     }

        //     statement.run([], function (err) {
        //         cb(err);
        //     });
        // });
    }


    /**
     * Get contract events
     * @param contract
     * @param event
     * @param options
     * @param cb
     */
    getContractEvents(contract, event, options = {}, cb) {
        options.fromBlock = !options.fromBlock ? 0 : options.fromBlock;
        options.toBlock = !options.toBlock ? 0xFFFFFFFFFF : options.toBlock;
        options.additionalStatement = !options.additionalStatement ? '' : options.additionalStatement;

        this.db.all(`
            SELECT * FROM "events"
            WHERE "block" <= ${options.toBlock}
            AND "block" >= ${options.fromBlock}
            AND "event" = '${event}'
            AND "contract" = '${contract}'
            ${options.additionalStatement}
        `, (err, values) => {
            cb(err, values);
        })

        // let statement = this.db.prepare("SELECT * FROM `events` WHERE block <= ? AND block >= ? AND event = ? AND contract = ? " + options.additionalStatement, [options.toBlock, options.fromBlock, event, contract], function () {
        //     statement.all([], function (err, values) {
        //         cb(err, values);
        //     })
        // });
    }

    /**
     * Get contract events field sum
     * @param contract
     * @param event
     * @param fieldNo
     * @param options
     * @param cb
     */
    getContractEventSum(contract, event, fieldNo, options = {}, cb) {
        options.fromBlock = !options.fromBlock ? 0 : options.fromBlock;
        options.toBlock = !options.toBlock ? 0xFFFFFFFFFF : options.toBlock;
        options.additionalStatement = !options.additionalStatement ? '' : options.additionalStatement;

        this.db.all(`
            SELECT bsum(v${fieldNo}) as sum FROM "events"
            WHERE "block" <= ${options.toBlock}
            AND "block" => ${options.fromBlock}
            AND "event" = '${event}'
            AND "contract" = '${contract}'
            ${options.additionalStatement}
        `, (err, values) => {
            cb(err, values);
        })

        // let statement = this.db.prepare(`SELECT bsum(v${fieldNo}) as sum FROM "events" WHERE block <= ? AND block >= ? AND event = ? AND contract = ? ` + options.additionalStatement, [options.toBlock, options.fromBlock, event, contract], function () {
        //     statement.all([], function (err, values) {
        //         cb(err, values);
        //     })
        // });
    }

    /**
     * Executes RAW SQL query
     * @param {string} query
     * @param {array} bindParams
     * @param {function} cb
     */
    rawQuery(query, cb) {
        this.db.all(query, (err, values) => {
            cb(err, values);
        });
        // let statement;

        // if (bindParams) {
        //     statement = this.db.prepare(query, bindParams);
        // } else {
        //     statement = this.db.prepare(query, []);
        // }

        // statement.all([], function (err, values) {
        //     cb(err, values);
        // })
    }

    /**
     * Call contract event handlers
     * @param contract
     * @param event
     * @param args
     * @param cb
     * @private
     */
    _handleEvent(contract, event, args, cb) {
        let that = this;
        let handle = contract + '_' + event;
        if (typeof this._eventHandler[handle] === 'undefined') {
            cb();
        }

        (async function () {
            for (let a in that._eventHandler[handle]) {
                if (that._eventHandler[handle].hasOwnProperty(a)) {
                    await (function () {
                        return new Promise(function (resolve) {
                            try {
                                that._eventHandler[handle][a].handler(contract, event, args, function () {
                                    resolve();
                                });
                            } catch (e) {
                                logger.error('Contract event handler failed: ' + contract + ' ' + event + ' ' + e);
                                resolve();
                            }
                        });
                    })();
                }


            }
            cb();
        })();

    }

    /**
     * Register event handler
     * CALLBACK REQUIRED
     * @param {string} contract Contract address
     * @param {string} event    Event
     * @param {(function(string, string, array, Function))} handler Handler callback. Calling callback required
     * @return {string}
     */
    registerEventHandler(contract, event, handler) {
        let handle = contract + '_' + event;
        if (typeof this._eventHandler[handle] === 'undefined') {
            this._eventHandler[handle] = [];
        }
        this._eventHandler[handle].push({handle: handle, handler: handler});

        return handle;
    }
}

module.exports = EventsDB;
