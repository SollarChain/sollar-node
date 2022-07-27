/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/**
 * bitcore-lib crypto plugin
 */

// const bitcore = require("bitcore-lib");
const Mnemonic = require("bitcore-mnemonic");
const bitcore = Mnemonic.bitcore;
const Message = bitcore.Message;
const logger = new (require(global.PATH.mainDir + '/modules/logger'))("bitcore");

const ADDRESS_PREFIX = 'sol';

/**
 * Public key 2 address
 * @param pub
 * @return {*}
 */
function public2address(pub) {
    pub = pub.substr(1);
    pub = ADDRESS_PREFIX + pub;

    return pub;
}

/**
 * Address 2 public key
 * @param add
 * @return {string}
 */
function address2pubic(add) {
    if(add.indexOf(ADDRESS_PREFIX) !== 0) {
        throw new Error('Invalid address');
    }

    return '1' + add.substr(ADDRESS_PREFIX.length);
}

/**
 * Validate sign
 * @param data
 * @param sign
 * @param publicKey
 * @return {*|Boolean}
 */
function validate(data, sign, publicKey) {
    publicKey = address2pubic(String(publicKey));
    data = String(data);
    sign = String(sign);
    try {
        return new Message(data).verify(publicKey, sign);
    } catch (e) {
        return false;
    }
}

/**
 * Sign data function
 * @param data
 * @param privateKeyData
 * @return {string}
 */
function sign(data, privateKeyData) {
    privateKeyData = String(privateKeyData);
    data = String(data);

    let privateKey = new bitcore.PrivateKey(privateKeyData);
    let message = new Message(data);

    return message.sign(privateKey).toString();
}

/**
 * Generate wallet from configured credentials
 * @param {object} config
 * @return {{keysPair: {private: {senderContainerName, certificateName}, public: *}}}
 */
function generateWallet(config) {
    let seed_phrase = new Mnemonic(Mnemonic.Words.English);
    let HDprivate_key = seed_phrase.toHDPrivateKey();
    let derived = HDprivate_key.derive("m/0'");
    let private_key = derived.privateKey;
    let address = private_key.toAddress().toString();

    return {
        keysPair: {
            private: private_key.toString(),
            seed_phrase: seed_phrase.toString(),
            public: public2address(address)
        }
    }
}

module.exports = function register(blockchain, config, storj,) {
    logger.info('Initialize...');

    /**
     * @var {Cryptography}
     */
    let crypto = storj.get('cryptography');

    crypto.registerSign('bitcore', validate, sign);

    blockchain.wallet.registerGeneratorHook(function () {
        return generateWallet(config);
    });
    
    crypto.registerGenerator('bitcore', function () {
        return generateWallet(config).keysPair;
    })

    logger.info('OK');
};
