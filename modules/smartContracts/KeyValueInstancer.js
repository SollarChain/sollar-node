/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */

/**
 * Make sub key-value DB in other key-value DB. Works with KeyValue, TransactionalKeyValue and with itself
 */
class KeyValueInstancer {
    /**
     *
     * @param {KeyValue|KeyValueInstancer|TransactionalKeyValue} dbInstance
     * @param {string} namespace
     */
    constructor(dbInstance, namespace) {
        this.namespace = namespace;
        this.db = dbInstance;
    }

    /**
     * Converts key to namespace key
     * @param key
     * @return {string}
     * @private
     */
    _keyToInstanceKey(key) {
        return this.namespace + '.' + key;
    }

    /**
     * Put data
     * @param {string} key
     * @param {string} value
     * @param {Function} callback
     * @return {*|void}
     */
    put(key, value, callback) {
        return this.db.put(this._keyToInstanceKey(key), value, callback);
    }

    /**
     * Get data
     * @param {string} key
     * @param {Function} callback
     * @return {*|void}
     */
    get(key, callback) {
        return this.db.get(this._keyToInstanceKey(key), callback);
    }

    /**
     * Remove data
     * @param {string} key
     * @param {Function} callback
     * @return {*|void}
     */
    del(key, callback) {
        return this.db.del(this._keyToInstanceKey(key), callback);
    }

    /**
     * Deploy. Only for TransactionalKeyValue
     * @param callback
     * @return {*|void}
     */
    deploy(callback) {
        return this.db.deploy(callback);
    }

    /**
     * Rollback only for TransactionalKeyValue
     * @param callback
     * @return {*|void}
     */
    rollback(callback) {
        return this.db.rollback(callback);
    }

    /**
     * Get undeployed transactions. Only for TransactionalKeyValue
     * @return {*|{}}
     */
    get transactions(){
        return this.db.transactions;
    }
}

module.exports = KeyValueInstancer;
