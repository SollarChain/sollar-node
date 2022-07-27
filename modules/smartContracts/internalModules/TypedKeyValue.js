/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */

/**
 * KeyValue that saves types
 */
class TypedKeyValue {

    constructor(name) {
        this.db = new KeyValue(name);
    }

    /**
     * Put value
     * @param key
     * @param value
     */
    put(key, value) {
        return this.db.put(key, JSON.stringify(value));
    }

    /**
     * Get value
     * @param key
     * @return {any}
     */
    get(key) {
        return JSON.parse(this.db.get(key));
    }

}
