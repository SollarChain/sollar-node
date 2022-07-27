/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */


/**
 * Thrusted Nodes validator
 * Checks digital signatures of blocks
  * Used as the main consensus of the network, blocking the work of alternative
  * In the absence of Thrusted Nodes blocks within 24 hours, disables the ready state,
  * and unlocks alternate consensuses
 *
 * Yep, I know that "trusted" and "tHrusted" are different words.
 * I specifically made it so that the word sounded like a Jewish accent...
 * Or maybe I was just mistaken. You will never know! (ಠ_ಠ)
 *                                                          IZZZIO, LLC.
 */

/**
 * Blockchain object
 * @type {Blockchain}
 */
let blockchain = null;

const ThrustedNodesTimeout = 86400 * 1000; //24hours
const MessageTimeout = 60000;
const AddMessageTimeout = 10000;
const consensusName = 'Thrusted Nodes';


/**
 * Do we want to generate network support blocks:
 * @type {boolean}
 */
let generateEmptyBlocks = true;

/**
 * Is it possible to use Trusted Consensus now
 * @type {boolean}
 */
let isReadyNow = true;

/**
 * All requests to add a block, for callbacks
 * @type {Array}
 */
let thrustedAwait = [];


const Wallet = require('../wallet');
/**
 * Test wallet
 * @type {Wallet}
 */
let testWallet = new Wallet();


let lastTimestampRequest = 0;
let lastRecepient = '';

const Block = require('../block');
const Signable = require('../blocksModels/signable');
const moment = require('moment');

/**
 * Checking the correctness of the block
 * @param {Block} newBlock
 * @param {Block} previousBlock
 */
function isValidNewBlock(newBlock, previousBlock) {

    if(typeof newBlock === 'undefined' || typeof previousBlock === 'undefined') {
        return false;
    }

    if(newBlock.previousHash !== previousBlock.hash) {
        console.log('Error: Thrusted Nodes: Invalid block previous hash');
        return false;
    }

    //Blocks that coincide in time are rejected due to the problem of multiple addition
    if(newBlock.timestamp <= previousBlock.timestamp) {
        return false;
    }

    if(newBlock.timestamp - previousBlock.timestamp < ThrustedNodesTimeout && newBlock.sign.length === 0 && newBlock.index > 5) {
        throw ('Error: Thrusted Nodes: Adding other consensus block disabled due security configuration.');
    }

    if(previousBlock.index + 1 !== newBlock.index) {
        console.log('Error: Thrusted Nodes: Invalid block index');
        return false;
    }

    if(typeof newBlock.sign === 'undefined') {
        console.log('Error: Thrusted Nodes: Block format incompatible with thrusted nodes consensus');
        return false;
    }

    if(newBlock.sign.length === 0) { //the block is not signed, we give it further
        return false;
    }

    const keyring = blockchain.blockHandler.keyring;

    for (let a in keyring) {
        if(keyring.hasOwnProperty(a)) {
            if(testWallet.verifyData(newBlock.hash, newBlock.sign, keyring[a])) {
                return true;
            }
        }
    }

    console.log('Error: Fake signed block');

    return false;
}

/**
 * Receives a callback on a timestamp
 * @param timestamp
 * @return {*}
 */
function getThrustedAwait(timestamp) {
    for (let a in thrustedAwait) {
        if(thrustedAwait.hasOwnProperty(a)) {
            if(Number(thrustedAwait[a].timestamp) === Number(timestamp)) {
                return thrustedAwait[a];
            }
        }
    }

    return false;
}

/**
 * Create a new block
 *
 * @param {Signable} blockData
 * @param {Function} cb
 * @param {Function} cancelCondition
 * @param {int} timestamp
 */
function generateNextBlock(blockData, cb, cancelCondition, timestamp) {

    /**
     * If we do not have the keys to immediately add a block to the network,
     * we can only ask other participants to add a block
     */
    if(!blockchain.blockHandler.isKeyFromKeyring(blockchain.wallet.keysPair.public)) {
        console.log('Info: Thrusted Nodes: Sending block addition request');

        /**
         * Sending a message
         */
        let message = blockchain.broadcastMessage(blockData, Math.random(), 'thrusted_node', blockchain.config.recieverAddress, 0);


        /**
         * If the waiting time has exceeded the timeout, then we consider the transaction unsuccessful
         * @type {number}
         */
        let timer = setTimeout(function () {
            for (let a in thrustedAwait) {
                if(thrustedAwait.hasOwnProperty(a)) {
                    if(Number(thrustedAwait[a].timestamp) === Number(message.timestamp)) {
                        thrustedAwait[a].callback();
                        delete thrustedAwait[a];
                        return;
                    }
                }
            }
        }, AddMessageTimeout);

        /**
         * Adding blocks to the waiting list
         */
        thrustedAwait.push({callback: cb, timestamp: message.timestamp, timer: timer});

        /*cb(new Block(-1, '', message.timestamp, blockData, '', message.timestamp, ''));*/
        //console.log('Error: This node can\'t create Thrusted blocks');
        return false;
    }

   /* if(typeof blockData === 'object') {
        blockData = JSON.stringify(blockData);
    }*/

    blockchain.getLatestBlock(function (previousBlock) {
        if(!previousBlock) {
            return;
        }

        let startTimestamp = moment().utc().valueOf(),
            nextTimestamp = moment().utc().valueOf();
        if(typeof timestamp !== 'undefined') {
            startTimestamp = timestamp;
            nextTimestamp = timestamp;
        }
        const nextIndex = previousBlock.index + 1;

        let hash = blockchain.calculateHash(nextIndex, previousBlock.hash, nextTimestamp, blockData, startTimestamp, '');

        let sign = blockchain.wallet.signData(hash).sign;

        let newBlock = new Block(nextIndex, previousBlock.hash, nextTimestamp, blockData, hash, startTimestamp, sign);

        cb(newBlock);
    });
}

/**
 * Creates an empty block to support transaction confirmation when idle
 */
function generateEmptyBlock() {
    let empty = new Signable();
    if(isReady()) {
        generateNextBlock(empty, function (generatedBlock) {
            blockchain.addBlock(generatedBlock);
            blockchain.broadcastLastBlock();
        });
    }
}

/**
 * Checking whether we will generate a new empty block
 * @return {boolean}
 */
function generateEmptyBlockCheck() {
    if(blockchain !== null && generateEmptyBlocks) {
        //We didn't release the keys
        if(!blockchain.blockHandler.isKeyFromKeyring(blockchain.wallet.keysPair.public)) {
            console.log('Info: We can\'t generate empty Thrusted blocks');
            generateEmptyBlocks = false;
            return false;
        }
        blockchain.getLatestBlock(function (previousBlock) {
            if(!previousBlock) {
                return;
            }
            if(moment().utc().valueOf() - previousBlock.timestamp > (blockchain.config.generateEmptyBlockDelay)) {
                console.log('Info: Create empty block');
                generateEmptyBlock();
            }
        });

    }
}

/**
 * Checking the possibility of using Trusted Consensus
 * @return {boolean}
 */
function isReady() {

    if(blockchain.blockHandler.isKeyFromKeyring(blockchain.wallet.keysPair.public)) {
        //If we are ready to work, then we turn off the generation of empty blocks of other consensuses
        for (let a in blockchain.config.validators) {
            if(blockchain.config.validators.hasOwnProperty(a) && blockchain.config.validators[a].consensusName !== consensusName) {
                try {
                    blockchain.config.validators[a].setGenerateEmptyBlocks(false);
                } catch (e) {
                    console.log(e);
                }
            }
        }
        return true;
    }

    if(blockchain.blockHandler.keyring.length !== 0 && isReadyNow) {
        isReadyNow = true;
    } else {
        isReadyNow = false;
    }

    blockchain.getLatestBlock(function (previousBlock) {
        if(!previousBlock) {
            isReadyNow = false;
        }


        /*console.log(previousBlock.sign.length);
        console.log(moment().utc().valueOf() - previousBlock.timestamp);*/

        if(typeof previousBlock.sign === 'undefined'){
            console.log(previousBlock);
            isReadyNow = false;
            return isReadyNow;
        }

        if(previousBlock.sign.length !== 0 && moment().utc().valueOf() - previousBlock.timestamp > ThrustedNodesTimeout) {
            isReadyNow = false;
        } else {
            if(moment().utc().valueOf() - previousBlock.timestamp > ThrustedNodesTimeout) {
                isReadyNow = false;
            } else {
                isReadyNow = true;
            }
        }

    });


    return isReadyNow;
}


/**
 * For trusted, any hash is valid
 * @return {boolean}
 */
function isValidHash() {
    return true;
}


/**
 * Incoming Message Handler
 * @param message
 */
function handleMessage(message) {
    /**
     * If we received a message for us as a trusted node
     */
    if(message.reciver === 'thrusted_node' && blockchain.blockHandler.isKeyFromKeyring(blockchain.wallet.keysPair.public)) {

        if(moment().utc().valueOf() - message.timestamp < MessageTimeout && lastTimestampRequest < message.timestamp && message.recepient !== lastRecepient) {

            lastTimestampRequest = message.timestamp;

            /**
             * each new block should be added with a new node
             **/
             // lastRecepient = message.recepient; 

            /**
             * Candidate block for adding to the network
             * Several trusted nodes can take the same block to add
             * to the network. To do this, the timestamp of the message is used as the block time
             * Checking the Timestamp match in this case will reject the duplicated block.
             */
            generateNextBlock(message.data, function (generatedBlock) {
                blockchain.addBlock(generatedBlock);
                blockchain.broadcastLastBlock();

                // console.log(message);
                console.log('Block added for ' + message.recepient);

                /**
                 * We send a response about the successful addition of the block
                 * with a slight delay
                 */
                setTimeout(function () {
                    blockchain.broadcastMessage({
                        type: 'thrusted_block_add',
                        timestamp: message.timestamp,
                        block: generatedBlock
                    }, Math.random(), message.recepient, blockchain.config.recieverAddress, 0);
                }, 100);


            }, null, message.timestamp);
        }

        return true;
    }

    /**
     * If we received a message from a trusted node
     */
    if(message.reciver === blockchain.config.recieverAddress && typeof message.data.type !== 'undefined' && message.data.type === 'thrusted_block_add') {
        let timestamp = message.data.timestamp;
        let block = message.data.block;
        for (let a in thrustedAwait) {
            if(thrustedAwait.hasOwnProperty(a)) {
                if(Number(thrustedAwait[a].timestamp) === Number(timestamp)) {
                    /**
                     * Note the addition of the block
                     */
                    clearTimeout(thrustedAwait[a].timer);
                    thrustedAwait[a].callback(block);
                    delete thrustedAwait[a];
                    return true;
                }
            }
        }
    }

    return false;
}

/**
 * Toggle empty blocks generation
 * @param generate
 */
function setGenerateEmptyBlocks(generate) {
    generateEmptyBlocks = generate;
}


module.exports = function (blockchainVar) {
    blockchain = blockchainVar;
    console.log('Info: Thrusted Nodes validator loaded');
    setInterval(generateEmptyBlockCheck, blockchain.config.emptyBlockInterval);
    setTimeout(function () {
        isReady();
    }, 5000);

    blockchain.registerMessageHandler('ThrustedNodes', handleMessage);


    return {
        consensusName: consensusName,
        isValidNewBlock: isValidNewBlock,
        generateNextBlock: generateNextBlock,
        isValidHash: isValidHash,
        isReady: isReady,
        generateEmptyBlock: generateEmptyBlock,
        setGenerateEmptyBlocks: setGenerateEmptyBlocks,
    };
};

