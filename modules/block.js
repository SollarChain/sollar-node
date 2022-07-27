/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */

const stableStringify = require('json-stable-stringify');

/**
 * It's a Block
 * Just block It!
 */
class Block {
    constructor(index, previousHash, timestamp, data, hash, startTimestamp, sign, wallet) {
        this.index = index;
        this.previousHash = String(previousHash).toString();
        this.timestamp = timestamp;
        this.startTimestamp = startTimestamp;
        if(typeof data === 'object') {
            data = stableStringify(data);
        }
        this.data = data;
        this.hash = String(hash).toString();
        this.sign = sign;
        this.wallet = wallet;
    }
}

module.exports = Block;
