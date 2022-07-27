/**
 * Encryption protocol for starwave
 * new fields in message object:
 * encrypted - means that message is encrypted
 * publicKey - public key of the sender which wants to make crypted tunnel
 * Using secp256k1 curve and aes256 algorithm as default
 *
 * This module uses elliptic library for creating keypair and crypto-js to encrypt/decrypt message
 * https://github.com/indutny/elliptic
 * https://github.com/brix/crypto-js
 */

'use strict';

//unify browser and node
if (typeof _this ==='undefined') {
    var _this = this;
}
if (_this.window === undefined){
    _this.elliptic = require('elliptic');
    _this.CryptoJS = require('crypto-js');
}

const SWCRYPTO_CONNECTION_MESSAGE_TYPE = 'DH-CONNECTION';

/**
 * Crypto addon for StarWave Protocol
 */
class StarwaveCrypto {

    constructor(starwaveProtocolObject, secretKeysKeyring, curve = 'secp256k1') {
        if (_this.window === undefined){
            this.elliptic = require('elliptic');
            this.CryptoJS = require('crypto-js');
        } else {
            this.elliptic = elliptic;
            this.CryptoJS = CryptoJS;
        }
        let that = this;
        // EСDH object
        this.ec = new elliptic.ec(curve);
        this.keyObject = this.ec.genKeyPair();
        this.public = this.generateKeys();
        this.starwave = starwaveProtocolObject;
        this.secretKeys = secretKeysKeyring;
        this.curve = curve;

        this._connectionsCallbacks = {};

        starwaveProtocolObject.registerMessageHandler(SWCRYPTO_CONNECTION_MESSAGE_TYPE, function (message) {
            that.handleIncomingMessage(message);
            return true;
        });

        starwaveProtocolObject.registerMessageHandler('', function (message) {
            that.handleIncomingMessage(message);
            return false;
        });
    };

    /**
     * Get public key object for Diffie-Hellman
     * @returns {*}
     */
    generateKeys(keyObject = this.keyObject) {
        return keyObject.getPublic(true, 'hex');
    }

    /**
     * Create secret key based on external public key
     * @param {string} externalPublic
     * @returns {string}
     */
    createSecret(externalPublic) {

        let secret;
        try {
            let pub = this.ec.curve.decodePoint(externalPublic, 'hex'); //get public key object from string
            secret = this.keyObject.derive(pub);
            secret = secret.toString(16);
        } catch (err) {
            console.log('Error: Can not create secret key ' + err); //if externalPublic is wrong
        }
        return secret;
    };


    /**
     * Encrypts data
     * @param {string} data Data to encrypt
     * @param {string} secret Encryption secret
     * @returns {string}
     */
    cipherData(data, secret) {
        let encrypted = CryptoJS.AES.encrypt(data, secret).toString(); //base64
        let b64 = CryptoJS.enc.Base64.parse(encrypted);//object
        encrypted = b64.toString(CryptoJS.enc.Hex);//hex
        return encrypted;
    }

    /**
     * Decripts data
     * @param {string} encryptedData Encrypted data source
     * @param {string} secret Encryption secret
     * @returns {string}
     */
    decipherData(encryptedData, secret) {
        let data;
        try {
            //unpack from hex to native base64 and to object
            let b64 = CryptoJS.enc.Hex.parse(encryptedData);
            let bytes = b64.toString(CryptoJS.enc.Base64);
            data = CryptoJS.AES.decrypt(bytes, secret);
            data = data.toString(CryptoJS.enc.Utf8);
        } catch (e) {
            console.log('Error decrypting data: ' + e)
        }
        return data;
    }

    /**
     * Decrypts data field in message
     * @param {object} message Message object
     * @returns {*}
     */
    decipherMessage(message) {
        let decryptedData;

        //if message didn't encrypted, return data
        if(!message.encrypted) {
            return decryptedData = message.data;
        }

        //if we have secret key associated with this socket than we have the tunnel
        if(this.secretKeys[message.sender]) {
            decryptedData = this.decipherData(message.data, this.secretKeys[message.sender]);
            if(decryptedData) {
                //try to parse json
                try {
                    decryptedData = JSON.parse(decryptedData)
                } catch (e) {
                    console.log("Error: An error occurred while parsing decrypted text: " + e);
                }
            }
            message.original = message.data;
            message.data = decryptedData;
            delete message.encrypted;
        }
        return decryptedData;
    }

    /**
     * Encrypts data field in message
     * @param {object} message Message object
     * @returns {*}
     */
    cipherMessage(message) {
        let cryptedData;
        //should be assotiated secret key and check that message has not been already encrypted
        if(this.secretKeys[message.reciver] && !message.encrypted) {
            cryptedData = this.cipherData(JSON.stringify(message.data), this.secretKeys[message.reciver]);
            message.encrypted = true;
            message.data = cryptedData;
        }
        return cryptedData;
    }

    /**
     * Processes incoming message
     * @param message
     * @returns {*}
     */
    handleIncomingMessage(message) {
        //watch if the message has Public key field then the message is only for sending the key
        if(message.publicKey) {
            let sc = this.createSecret(message.publicKey); //exclude situation with exception on wrong public
            //if we don't have secret key then we save sender publickey and create secret and send our public to make connection
            if((!this.secretKeys[message.sender] && sc) || this.secretKeys[message.sender] !== sc) {
                this.makeConnection(message.sender);
            }
            if(sc) {
                this.secretKeys[message.sender] = sc;
                if(this._connectionsCallbacks[message.sender]) {
                    this._connectionsCallbacks[message.sender](message.sender, sc);
                    delete this._connectionsCallbacks[message.sender];
                }
            }
            delete message.publicKey;
            return 0;
        }

        message.data = this.decipherMessage(message); //undefined if we have errors
        return 1;
    }

    /**
     * Make encrypted connection
     * @param {string} messageBus   Connection address
     * @param {(function(string, string))} cb Connection callback 1 - receiver, 2 - secret key
     * @return {StarwaveCrypto}
     */
    makeConnection(messageBus, cb) {
        let that = this;
        if(cb) {
            this._connectionsCallbacks[messageBus] = cb;

            //Call callback if key already created
            if(this.secretKeys[messageBus]) {
                setTimeout(function () {
                    cb(messageBus, that.secretKeys[messageBus]);
                }, 1);
            }
        }
        let message = this.starwave.createMessage('{}', messageBus, undefined, SWCRYPTO_CONNECTION_MESSAGE_TYPE);
        message.publicKey = this.public;
        this.starwave.sendMessage(message);
        return this;
    }

    /**
     * Send message using encryption protocol
     * @param {object} message Data for sending
     * @returns {number} Status
     */
    sendMessage(message) {
        //check if we have secret key for reciver
        let sk = this.secretKeys[message.reciver]; //secret key
        if(sk) {
            if(this.cipherMessage(message)) {
                this.starwave.sendMessage(message);
                return message;
            } else {
                console.log("Error: Can't cipher message");
                return 2;
            }
        }
        else {
            console.log(`Error: There is no secret key for address: ${message.reciver}`);
            return 1;
        }
    }

}

//unify browser and node
if (this.window === undefined){
    module.exports = StarwaveCrypto;
}