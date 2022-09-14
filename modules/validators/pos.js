

const CONSENSUS_NAME = 'PoS';
let blockchain = null;

/**
 * Do we want to generate network support blocks:
 * @type {boolean}
 */
let generateEmptyBlocks = true;
const ThrustedNodesTimeout = 86400 * 1000; //24hours

const Wallet = require('../wallet');
const Block = require('../block');
const EcmaContractCallBlock = require('../smartContracts/blocksModels/EcmaContractCallBlock');
const Signable = require('../blocksModels/signable');
const storj = require('../instanceStorage');
const moment = require('moment');


/**
 * Test wallet
 * @type {Wallet}
 */
let testWallet = new Wallet();

const existsContracts = {};

async function contractExist(address) {
    if (existsContracts[address]) {
        return existsContracts[address];
    }

    const ecmaContract = storj.get('ecmaContract');
    const isContractExists = await ecmaContract.contractExists(address);
    return existsContracts[address] = isContractExists;
}

async function callMethodRollback(address, method, args = [], state = {}) {
    return new Promise(async (resolve, reject) => {
        const ecmaContract = storj.get('ecmaContract');

        if (!(await contractExist(address))) {
            resolve(false);
        }

        try {
            ecmaContract.callContractMethodRollback(address, method, state, function (err, result) {
                if(err) {
                    reject(err);
                    return;
                }
                resolve(result);
            }, ...args);
        } catch (e) {
            reject(e);
        }
    })
}

/**
 * Checking the correctness of the block
 * @param {Block} newBlock
 * @param {Block} previousBlock
 */
async function isValidNewBlock(newBlock, previousBlock) {
    if(typeof newBlock === 'undefined' || typeof previousBlock === 'undefined') {
        console.log('isValidNewBlock 1', newBlock, previousBlock);
        return false;
    }

    if(newBlock.previousHash !== previousBlock.hash) {
        console.log('Error: Thrusted Nodes: Invalid block previous hash');
        return false;
    }

    //Blocks that coincide in time are rejected due to the problem of multiple addition
    if(newBlock.timestamp <= previousBlock.timestamp) {
        console.log('Error: Thrusted Nodes: Invalid timestamps', newBlock.timestamp <= previousBlock.timestamp);
        return false;
    }

    if(newBlock.timestamp - previousBlock.timestamp < ThrustedNodesTimeout && newBlock.sign.length === 0 && newBlock.index > 5) {
        console.log('Error: Thrusted Nodes: Adding other consensus block disabled due security configuration.');

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
        console.log('Sign null');

        return false;
    }

    if ([1, 2].includes(newBlock.index)) {
        return true;
    }

    // console.log('\n');
    console.log('POS check block', previousBlock.index, '-', newBlock.index);
    const masterContractAddress = blockchain.config.ecmaContract.masterContract;
    const isValidWallet = await callMethodRollback(masterContractAddress, 'checkBlockSign', [newBlock.hash, newBlock.sign]) || testWallet.verifyData(newBlock.hash, newBlock.sign, JSON.parse(newBlock.data)?.state?.from);
    let feeFromBlock;

    if (newBlock.fee) {
        feeFromBlock = await callMethodRollback(masterContractAddress, 'getFeeFromBlock', [newBlock]);
    }

    // console.log('pos', masterContractAddress, isValidWallet, newBlock.fee, feeFromBlock);

    const checkBlockFee = typeof newBlock.fee === 'undefined' || newBlock.fee == feeFromBlock;
    // console.log('pos 2', isValidWallet, checkBlockFee);
    return isValidWallet && checkBlockFee;
}

const thrustedAwait = [];
const AddMessageTimeout = 10 * 1000;
const MessageTimeout = 60 * 1000;
let lastTimestampRequest = 0;
let lastRecepient = '';

/**
 * Creates a new block
 *
 * @param {Signable} blockData
 * @param {Function} cb
 * @param {Function} cancelCondition
 * @param {int} timestamp
 */
async function generateNextBlock(blockData, cb, cancelCondition, timestamp, fromRequest=false) {
    // if(typeof blockData === 'object') {
    //     blockData = JSON.stringify(blockData);
    // }
    const jsonBlockData = typeof blockData === 'object' ? blockData : JSON.parse(blockData);
    
    const masterContractAddress = blockchain.config.ecmaContract.masterContract;
    if (await contractExist(masterContractAddress)) {
        // console.log('generateNextBlock', blockchain.wallet.keysPair.public);
        const isNodeCanValidate = await callMethodRollback(masterContractAddress, 'checkIsNodeCanValidate', [blockchain.wallet.keysPair.public]);
        // console.log('isNodeCanValidate', isNodeCanValidate);
    
        // blockchain.sockets.forEach(socket => {
        //     console.log('connected sockets', socket);
        // })

        if (!isNodeCanValidate) {
            console.log('Info: Thrusted Nodes: Sending block addition request');

            blockchain.getLatestBlock(function (previousBlock) {
                if(!previousBlock) {
                    return false;
                }

                /**
                 * Sending a message
                 */
                // console.log('blockData', blockData);
                const message = blockchain.broadcastMessage({ blockData: jsonBlockData, previousBlock }, 'SelectAddBlock', 'thrusted_node', blockchain.config.recieverAddress, 0);
                console.log('Message with', message.timestamp, 'sended');
                /**
                 * If the waiting time has exceeded the timeout, then we consider the transaction unsuccessful
                 * @type {number}
                 */
                const timer = setTimeout(() => {
                    for (const key in thrustedAwait) {
                        if(thrustedAwait.hasOwnProperty(key)) {
                            if(Number(thrustedAwait[key].timestamp) === Number(message.timestamp)) {
                                console.log('Message with', message.timestamp, 'closed');
                                thrustedAwait[key].callback();
                                delete thrustedAwait[key];
                                return;
                            }
                        }
                    }
                }, AddMessageTimeout);

                thrustedAwait.push({callback: cb, timestamp: message.timestamp, timer: timer});
            });

            return false;
        }
    }

    blockchain.getLatestBlock(function (previousBlock) {
        if(!previousBlock) {
            return
        }

        let startTimestamp = moment().utc().valueOf(),
            nextTimestamp = moment().utc().valueOf();
        if(typeof timestamp !== 'undefined') {
            startTimestamp = timestamp;
            nextTimestamp = timestamp;
        }

        const nextIndex = previousBlock.index + 1;
        const hash = blockchain.calculateHash(nextIndex, previousBlock.hash, nextTimestamp, JSON.stringify(jsonBlockData), startTimestamp, '');
        const sign = blockchain.wallet.signData(hash).sign;
        const wallet = jsonBlockData.wallet;
        const newBlock = new Block(nextIndex, previousBlock.hash, nextTimestamp, jsonBlockData, hash, startTimestamp, sign, wallet);

        // console.log('pos DATA', nextIndex, jsonBlockData.data);

        if (!fromRequest) {
            setTimeout(() => {
                blockchain.broadcastMessage({
                    type: 'thrusted_block_add',
                    timestamp: newBlock.timestamp,
                    block: newBlock,
                }, 'AddedBlock', 'thrusted_node', blockchain.config.recieverAddress, 0);
            }, 100);
        }

        cb(newBlock);
    })
}

/**
 * Creates an empty block to support transaction confirmation when idle
 */
function generateEmptyBlock() {
    console.log('Generate empty block');

    const empty = new Signable();
    empty.state = {from: blockchain.wallet.keysPair.public};
    generateNextBlock(empty, (generatedBlock) => {
        blockchain.addBlock(generatedBlock, () => {
            blockchain.broadcastLastBlock();
        })
    });
}

function generateEmptyBlockCheck() {
    if (blockchain && generateEmptyBlocks) {
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
 * For pos, any hash is valid
 * @return {boolean}
 */
function isValidHash() {
    return true;
}

/**
 * Checking the possibility of using PoS consensus
 * @return {boolean}
 */
function isReady() {
    return true;
}


let isPosAddingTimeout = null;

function saveIsPosAdding() {
    clearTimeout(isPosAddingTimeout);
    storj.put('isPosAdding', true);
    isPosAddingTimeout = setTimeout(() => {
        storj.put('isPosAdding', false);
    }, 10 * 1000);
}

async function handleMessageSelectAddBlock(message) {
    if (storj.get('chainResponseMutex') || storj.get('syncInProgress')) {
        return setTimeout(() => handleMessageSelectAddBlock(message), 100);
    }

    console.log('handleMessageSelectAddBlock', message.id);

    if (message.reciver === 'thrusted_node') {
        const masterContractAddress = blockchain.config.ecmaContract.masterContract;
        const isNodeCanValidate = await callMethodRollback(masterContractAddress, 'checkIsNodeCanValidate', [blockchain.wallet.keysPair.public]);

        blockchain.broadcastMessage({ message, isNodeCanValidate }, 'SelectAddBlockCB', message.recepient, blockchain.config.recieverAddress);
    }
}

const validatorsTimestamps = {};
async function handleMessageSelectAddBlockCB(message) {
    if (storj.get('chainResponseMutex') || storj.get('syncInProgress')) {
        return setTimeout(() => handleMessageSelectAddBlockCB(message), 100);
    }

    console.log('handleMessageSelectAddBlockCB', message.id);

    const previousMessage = message.data.message;

    if (message.reciver === blockchain.config.recieverAddress) {
        if(moment().utc().valueOf() - previousMessage.timestamp < MessageTimeout 
            && lastTimestampRequest < previousMessage.timestamp 
            && previousMessage.recepient !== lastRecepient
        ) {
            console.log('previousMessage.timestamp', previousMessage.timestamp);
            if (message.data.isNodeCanValidate && !validatorsTimestamps[previousMessage.timestamp]) {
                validatorsTimestamps[previousMessage.timestamp] = true;
                blockchain.broadcastMessage(previousMessage, 'AddBlock', message.recepient, blockchain.config.recieverAddress, 0);
            }
        }
    }
}

async function syncPreviousBlock(messagePreviousBlock) {
    return new Promise(resolve => {
        blockchain.getLatestBlock(async function (previousBlock) {
            if (messagePreviousBlock.index - 1 === previousBlock.index) {
                blockchain.addBlock(messagePreviousBlock, resolve);
            } else {
                resolve();
            }
        })
    })
}

/**
 * Incoming Message Handler
 * @param message
 */
async function handleMessageAddBlock(message) {
    if (storj.get('chainResponseMutex') || storj.get('syncInProgress')) {
        return setTimeout(() => handleMessageAddBlock(message), 100);
    }
    
    console.log('handleMessageAddBlock', message.id);

    const previousMessage = message.data;

    if (message.reciver === blockchain.config.recieverAddress) {
        if(moment().utc().valueOf() - previousMessage.timestamp < MessageTimeout && lastTimestampRequest < previousMessage.timestamp && message.recepient !== lastRecepient) {
            // console.log('message', message);
            await syncPreviousBlock(previousMessage.data.previousBlock);
            
            const masterContractAddress = blockchain.config.ecmaContract.masterContract;
            const isNodeCanValidate = await callMethodRollback(masterContractAddress, 'checkIsNodeCanValidate', [blockchain.wallet.keysPair.public]);
            if (!isNodeCanValidate) {
                blockchain.broadcastMessage({
                    type: 'thrusted_block_cant_add',
                    timestamp: previousMessage.timestamp,
                }, 'AddedBlock', previousMessage.recepient, blockchain.config.recieverAddress, 0);
                return;
            }

            lastTimestampRequest = previousMessage.timestamp;

            const messageBlockData = previousMessage.data.blockData;
            messageBlockData.state.from = blockchain.wallet.keysPair.public;
            const state = messageBlockData.state;
            let blockData = new EcmaContractCallBlock(messageBlockData.address, messageBlockData.method, messageBlockData.args, state);

            const accountManager = storj.get('accountManager');
            const wallet = await accountManager.getAccountAsync(false);

            blockData = wallet.signBlock(blockData);

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
            generateNextBlock(JSON.stringify(blockData), (generatedBlock) => {
                blockchain.addBlock(generatedBlock, () => {
                    blockchain.broadcastLastBlock();      
                    // saveIsPosAdding();

                    console.log(`Block with index ${generatedBlock.index} added for ${previousMessage.recepient}`);

                    /**
                     * We send a response about the successful addition of the block
                     * with a slight delay
                     */
                    setTimeout(() => {
                        blockchain.broadcastMessage({
                            type: 'thrusted_block_add',
                            timestamp: previousMessage.timestamp,
                            block: generatedBlock,
                        }, 'AddedBlock', 'thrusted_node', blockchain.config.recieverAddress, 0);
                    }, 100);
                })
            }, null, previousMessage.timestamp, true);
        }

        return true;
    }

    return false;
}

function getThrustedByTimestamp(timestamp) {
    for (const key in thrustedAwait) {
        if(thrustedAwait.hasOwnProperty(key)) {
            if(Number(thrustedAwait[key].timestamp) === Number(timestamp)) {
                return thrustedAwait[key];
            }
        }
    }
}

function removeThrustedByTimestamp(timestamp) {
    for (const key in thrustedAwait) {
        if(thrustedAwait.hasOwnProperty(key)) {
            if(Number(thrustedAwait[key].timestamp) === Number(timestamp)) {
                clearTimeout(thrustedAwait[key].timer);
                delete thrustedAwait[key];
            }
        }
    }
}

async function handleMessageAddedBlock(message) {
    if (storj.get('chainResponseMutex') || storj.get('syncInProgress')) {
        return setTimeout(() => handleMessageAddedBlock(message), 100);
    }

    console.log('handleMessageAddedBlock', message.id);
    /**
     * If we received a message from a trusted node
     */

    if (message.data?.type === 'thrusted_block_add') {
        const timestamp = message.data.timestamp;
        const block = message.data.block;

        const thrusted = getThrustedByTimestamp(timestamp);
        if (thrusted) {
            blockchain.broadcastMessage({
                type: 'thrusted_block_add',
                timestamp: block.timestamp,
                block: block,
            }, 'AddedBlock', 'thrusted_node', blockchain.config.recieverAddress, 0);

            setTimeout(() => {
                thrusted.callback(block);
                removeThrustedByTimestamp(timestamp);
                console.log('Message with', timestamp, 'callback');
            }, 100);

            return true;
        } else {
            blockchain.getLatestBlock(async function (previousBlock) {
                if(!previousBlock) {
                    console.log('previousBlock', previousBlock);
                    return
                }

                if (block.previousHash === previousBlock.hash) {
                    // saveIsPosAdding();
                    blockchain.addBlock(block, () => {
                        console.log('Added block', block.index);
                    })
                }
            });
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

    if(blockchain.config.emptyBlockInterval) {
        setInterval(generateEmptyBlockCheck, blockchain.config.emptyBlockInterval);
    }

    const starwave = storj.get('starwaveProtocol');
    storj.put('isPosActive', true);

    starwave.registerMessageHandler('SelectAddBlock', handleMessageSelectAddBlock);
    starwave.registerMessageHandler('SelectAddBlockCB', handleMessageSelectAddBlockCB);
    starwave.registerMessageHandler('AddBlock', handleMessageAddBlock);
    starwave.registerMessageHandler('AddedBlock', handleMessageAddedBlock);

    console.log(`Info: Pos validator loaded`);

    return {
        consensusName: CONSENSUS_NAME,
        isValidNewBlock: isValidNewBlock,
        generateNextBlock: generateNextBlock,
        isValidHash: isValidHash,
        isReady: isReady,
        generateEmptyBlock: generateEmptyBlock,
        setGenerateEmptyBlocks: setGenerateEmptyBlocks,
    };
}