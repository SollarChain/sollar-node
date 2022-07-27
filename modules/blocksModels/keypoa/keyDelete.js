/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */


const Signable = require('../signable');
const storj = require('../../instanceStorage');
const cryptography = storj.get('cryptography');
let type = 'KO-KEY-DELETE';

/**
 * KeyPOA key issue block
 * @type {Signable}
 */
class KeyIssue extends Signable {

    /**
     *
     * @param {string} publicKey
     */
    constructor(publicKey) {
        super();
        this.type = type;
        this.publicKey = publicKey;
        this.generateData();
    }

    /**
     * Creates a data string for the signature
     */
    generateData() {
        this.data = this.type + cryptography.hash(this.publicKey);
    }


}

module.exports = KeyIssue;
