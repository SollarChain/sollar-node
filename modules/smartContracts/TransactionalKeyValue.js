/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */

const KeyValue = require('../keyvalue');

/**
 * Transactional key-value DB
 */
class TransactionalKeyValue {
    constructor(name) {
        /**
         * Contains transactions that are ready to be recorded
         * @type {{}}
         */
        this.transactions = {};

        /**
         * Value Storage
         * @type {KeyValue}
         */
        this.db = new KeyValue(name);
    }

    /**
     * Retrieves data from storage. If there is unsaved data, returns from them
     * @param {string} key
     * @param {Function} callback
     */
    get(key, callback = () => {
    }) {
        if(typeof this.transactions[key] !== 'undefined') {
            if(this.transactions[key] !== null) {
                callback(null, this.transactions[key]);
            } else {
                callback(true);
            }
        } else {
            this.db.get(key, function (err, val) {
                if(!err) {
                    callback(err, val.toString());
                } else {
                    callback(err);
                }
            });
        }
    }

    /**
     * Saves data to temporary transactional storage
     * @param {string} key
     * @param {string} value
     * @param {Function} callback
     */
    put(key, value, callback = () => {
    }) {
        this.transactions[key] = String(value);
        callback(null);
    }

    /**
     * Saves information about deleting a value to the transactional storage
     * @param key
     * @param callback
     */
    del(key, callback = () => {
    }) {
        this.transactions[key] = null;
        callback(null);
    }

    /**
     * Resetting the transaction queue
     * @param callback
     */
    rollback(callback = () => {
    }) {
        this.transactions = {};
        callback(null);
    }

    /**
     * Recording transaction data in the database
     * @param callback
     */
    deploy(callback = () => {
    }) {
        let that = this;

        function delPromised(key) {
            return new Promise(function (resolve) {
                that.db.del(key, function () {
                    resolve(true);
                })
            });
        }

        function putPromised(key, value) {
            return new Promise(function (resolve) {
                that.db.put(key, value, function () {
                    resolve(true);
                })
            });
        }

        async function deployAll() {
            for (let a in that.transactions) {
                if(that.transactions.hasOwnProperty(a)) {
                    if(that.transactions[a] === null) {
                        await delPromised(a);
                    } else {
                        await putPromised(a, that.transactions[a]);
                    }
                }
            }

            that.rollback(function () {
                callback(true);
            });

        }

        deployAll();
    }

    /**
     * Save DB. Saves only deployed data
     * @param cb
     */
    save(cb) {
        return this.db.save(cb);
    }

    /**
     * Clear DB
     * @param cb
     */
    clear(cb) {
        this.transactions = {};
        return this.db.clear(cb);
    }

    close(cb){
        this.transactions = {};
        return this.db.close(cb);
    }
}

module.exports = TransactionalKeyValue;
