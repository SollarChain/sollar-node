/**
 * Digital Signature for Candy
 * uses SHA256withRSA algorithm
 * required forge.min.js
 * https://github.com/digitalbazaar/forge
 */

'use strict';

//unify browser and node
if(typeof _this === 'undefined') {
    var _this = this;
}

/**
 * Crypto signs methods
 * @param {string} dataToSign Optional: data for sign
 * @return {DigitalSignature}
 * @constructor
 */
function DigitalSignature(dataToSign) { //data in string format
    if(_this.window === undefined) {
        this.forge = require('node-forge');
    } else {
        this.forge = forge;
    }

    /**
     * RSA keys for sign
     */
    this.keysPair = {};

    /**
     * Sign
     */
    this.sign = '';

    /**
     * Data format as presented in 'block data'
     */
    this.signedData = {
        data: dataToSign,     //incoming data
        sign: '',              //sign in HEX format
        pubkey: ''             //Public key in pem PKCS#1
    };

    /**
     * Generate pair of keys for signing
     * @param {number} len Length of the key
     */
    this.generate = (len = 2048) => {

        let rsa = this.forge.pki.rsa;
        let keypair = this.forge.rsa.generateKeyPair({len});
        keypair = {
            public: repairKey(fix(this.forge.pki.publicKeyToRSAPublicKeyPem(keypair.publicKey, 72))),
            private: repairKey(fix(this.forge.pki.privateKeyToPem(keypair.privateKey, 72)))
        };
        this.keysPair = keypair;
        console.log('Info: Keypair generated');
        return keypair;
    };


    /**
     * PEM key fixing
     * @param str
     * @return {string}
     */
    function fix(str) {
        return str.replace(/\r/g, '') + '\n'
    }

    /**
     * Repair bad generated key
     * @param key
     * @return {string}
     */
    function repairKey(key) {
        if(key[key.length - 1] !== "\n") {
            key += "\n";
        }
        return key.replace(new RegExp("\n\n", 'g'), "\n");
    }

    /**
     * Signs data
     * @param {data} data for signing
     * @param {key} key
     */


    /**
     * Sign data
     * @param {string} data Data
     * @param {string} key Private key
     * @return {{data: {string}, sign:{string}}} Data - signable data, sign - Sign
     */
    this.signData = (data = dataToSign, key = this.keysPair.private) => {
        if(!data) {
            console.log('No data to sign');
            return '';
        }
        let md = this.forge.md.sha256.create();
        md.update(data, 'utf8');
        let privateKey = this.forge.pki.privateKeyFromPem(key);
        this.sign = privateKey.sign(md);
        console.log('Info: Data signed');
        return {data: data, sign: this.forge.util.bytesToHex(this.sign)};
    };


    /**
     * Signs data
     * @param {string} data Signed data for verify
     * @param {string} sign Sign
     * @param {string} key Public key
     */
    this.verifyData = (data = this.signedData, sign = this.signedData.sign, key = this.signedData.pubkey) => {
        if(typeof data === 'object') {
            sign = data.sign;
            data = data.data;
        }
        try {
            let publicKey = this.forge.pki.publicKeyFromPem(repairKey(fix(key)));
            let md = this.forge.md.sha256.create();
            md.update(data, 'utf8');
            return publicKey.verify(md.digest().bytes(), this.forge.util.hexToBytes(sign)); //verifying only in bytes format
        } catch (e) {
            console.log(e);
            return false;
        }
    };

    if(dataToSign !== undefined) {
        this.keysPair = this.generate();
        this.signedData.pubkey = this.keysPair.public;
        this.signedData.sign = this.signData().sign;
        if(this.verifyData() === false) {
            console.log('Sign self-validation error! Invalid key or sign checking');
        }
    }

    return this;
}

//unify browser and node
if(this.window === undefined) {
    module.exports = DigitalSignature;
}