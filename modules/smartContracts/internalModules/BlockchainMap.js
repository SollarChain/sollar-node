/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */

/**
 * Map structure
 */
class BlockchainMap {

    constructor(name) {
        this.db = new TypedKeyValue(name);
        return new Proxy(this, {
            /**
             * Replace getters
             * @param target
             * @param item
             * @return {*}
             */
            get(target, item) {
                if(typeof target[item] !== 'undefined') {
                    return target[item];
                }
                return target.db.get(item);
            },
            /**
             * Replace setters
             * @param target
             * @param item
             * @param value
             */
            set(target, item, value) {
                if(typeof target[item] !== 'undefined') {
                    return value;
                }
                target.db.put(item, value);
                return true;
            }
        });
    }

}
