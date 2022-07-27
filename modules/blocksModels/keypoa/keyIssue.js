/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */


const Signable = require('../signable');
const storj = require('../../instanceStorage');
const cryptography = storj.get('cryptography');
let type = 'KO-KEY-ISSUE';

/**
 * KeyPOA key delete block
 * @type {Signable}
 */
class KeyIssue extends Signable {

    /**
     *
     * @param {string} publicKey
     * @param {string} keyType
     */
    constructor(publicKey, keyType) {
        super();
        this.type = type;
        this.publicKey = publicKey;
        this.keyType = keyType;
        this.generateData();
    }

    /**
     * Creates a data string for the signature
     */
    generateData() {
        this.data = this.type + cryptography.hash(this.publicKey + this.keyType);
    }


}

module.exports = KeyIssue;
