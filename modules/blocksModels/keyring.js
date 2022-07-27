/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */

const Signable = require('./signable');
const fs = require('fs-extra');
const storj = require('../instanceStorage');
const cryptography = storj.get('cryptography');

let type = 'Keyring';

/**
 * Keyring
 * @type {Signable}
 */
class Keyring extends Signable {
    /**
     *
     * @param {Array} keys
     * @param {String} initiator
     */
    constructor(keys, initiator) {
        super();
        this.type = type;
        this.keys = keys;
        this.initiator = initiator;
        this.generateData();
    }

    /**
     * Creates a data string for the signature
     */
    generateData() {
        this.data = this.type + JSON.stringify(this.keys) + this.initiator;
    }

    /**
     * Creates a list of trusted keys
     * @param {String} keyfile
     * @param {Number} keyCount
     * @param {Wallet} wallet
     */
    generateKeys(keyfile, keyCount, wallet) {
        let generatedKeys = [];
        console.log('Keyring: Generating keys for emission');
        generatedKeys.push(wallet.keysPair);
        this.keys.push(wallet.keysPair.public);
        for (let i = 1; i < keyCount; i++) {
            let key = cryptography.generateKeyPair();
            this.keys.push(key.public);
            generatedKeys.push(key);
        }

        fs.writeFileSync(keyfile, JSON.stringify(generatedKeys));

        console.log('Keyring: Saving generated keys to ' + keyfile);

        this.generateData();
    }
}

module.exports = Keyring;
