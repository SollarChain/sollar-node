

const CONSENSUS_NAME = 'PoS';
let blockchain = null;

/**
 * Do we want to generate network support blocks:
 * @type {boolean}
 */
let generateEmptyBlocks = true;
const ThrustedNodesTimeout = 24 * 60 * 60 * 1000; //24hours

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

    const masterContractAddress = blockchain.config.ecmaContract.masterContract;
    const isValidWallet = await callMethodRollback(masterContractAddress, 'checkBlockSign', [newBlock.hash, newBlock.sign]) || testWallet.verifyData(newBlock.hash, newBlock.sign, JSON.parse(newBlock.data)?.state?.from);
    let feeFromBlock;

    if (newBlock.fee) {
        feeFromBlock = await callMethodRollback(masterContractAddress, 'getFeeFromBlock', [newBlock]);
    }

    const checkBlockFee = typeof newBlock.fee === 'undefined' || newBlock.fee == feeFromBlock;
    return isValidWallet && checkBlockFee;
}

const thrustedAwait = [];
const AddMessageTimeout = 10 * 1000;
const MessageTimeout = 1 * 60 * 1000;
let lastTimestampRequest = 0;

/**
 * Creates a new block
 *
 * @param {Signable} blockData
 * @param {Function} cb
 * @param {Function} cancelCondition
 * @param {int} timestamp
 */
async function generateNextBlock(blockData, cb, cancelCondition, timestamp, notifyOtherNodes=true) {
    // if(typeof blockData === 'object') {
    //     blockData = JSON.stringify(blockData);
    // }

    const jsonBlockData = typeof blockData === 'object' ? blockData : JSON.parse(blockData);
    
    const masterContractAddress = blockchain.config.ecmaContract.masterContract;
    if (await contractExist(masterContractAddress)) {
        const isNodeCanValidate = await callMethodRollback(masterContractAddress, 'checkIsNodeCanValidate', [blockchain.wallet.keysPair.public]);

        if (!isNodeCanValidate && notifyOtherNodes) {
            console.log('Info: Sending block addition request');

            /**
             * Sending a message
             */
            const message = blockchain.broadcastMessage({ blockData: jsonBlockData }, 'SelectAddBlock', 'thrusted_node', blockchain.config.recieverAddress, 0);
            // console.log('Message with', message.timestamp, 'sended');
            /**
             * If the waiting time has exceeded the timeout, then we consider the transaction unsuccessful
             * @type {number}
             */
            const timer = setTimeout(() => {
                for (const key in thrustedAwait) {
                    if(thrustedAwait.hasOwnProperty(key)) {
                        if(Number(thrustedAwait[key].timestamp) === Number(message.timestamp)) {
                            // console.log('Message with', message.timestamp, 'closed');
                            thrustedAwait[key].callback();
                            delete thrustedAwait[key];
                            return;
                        }
                    }
                }
            }, AddMessageTimeout);

            thrustedAwait.push({callback: cb, timestamp: message.timestamp, timer: timer});

            return;
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

        if (notifyOtherNodes) {
            blockchain.broadcastMessage({
                type: 'thrusted_block_add',
                timestamp: newBlock.timestamp,
                block: newBlock,
            }, 'AddedBlock', 'thrusted_node', blockchain.config.recieverAddress, 0);
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
    }, undefined, undefined, false);
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

async function handleMessageSelectAddBlock(message) {
    if (message.reciver === 'thrusted_node') {
        blockchain.broadcastMessage({ message }, 'SelectAddBlockCB', message.recepient, blockchain.config.recieverAddress);
    }
}

async function handleMessageSelectAddBlockCB(message) {
    const previousMessage = message.data.message;

    if (message.reciver === blockchain.config.recieverAddress) {
        if (moment().utc().valueOf() - previousMessage.timestamp < MessageTimeout && 
            lastTimestampRequest < previousMessage.timestamp
        ) {
            const onlineNodes = blockchain.getPeersMessageBusAddress();
            const masterContractAddress = blockchain.config.ecmaContract.masterContract;
            const isNodeCanValidate = await callMethodRollback(masterContractAddress, 'checkIsNodeCanValidate', [message.recepient, onlineNodes]);

            const thrusted = getThrustedByTimestamp(previousMessage.timestamp);

            if (isNodeCanValidate && thrusted && !thrusted.sendOnValidation) {
                thrusted.sendOnValidation = true;
                console.log(`Info: Sending to ${message.recepient} block addition request`);
                blockchain.broadcastMessage(previousMessage, 'AddBlock', message.recepient, blockchain.config.recieverAddress, 0);
            }
        }
    }
}

/**
 * Incoming Message Handler
 * @param message
 */
async function handleMessageAddBlock(message) {
    const previousMessage = message.data;

    if (message.reciver === blockchain.config.recieverAddress) {
        if (moment().utc().valueOf() - previousMessage.timestamp < MessageTimeout && 
            lastTimestampRequest < previousMessage.timestamp
        ) {
            lastTimestampRequest = previousMessage.timestamp;

            const accountManager = storj.get('accountManager');
            const wallet = await accountManager.getAccountAsync(false);

            const messageBlockData = previousMessage.data.blockData;
            messageBlockData.state.from = blockchain.wallet.keysPair.public;
            
            let blockData = new EcmaContractCallBlock(messageBlockData.address, messageBlockData.method, messageBlockData.args, messageBlockData.state);
            blockData = wallet.signBlock(blockData);

            /**
             * Candidate block for adding to the network
             * Several trusted nodes can take the same block to add
             * to the network. To do this, the timestamp of the message is used as the block time
             * Checking the Timestamp match in this case will reject the duplicated block.
             */
            generateNextBlock(JSON.stringify(blockData), async (generatedBlock) => {
                blockchain.addBlock(generatedBlock, async () => {
                    blockchain.broadcastLastBlock();

                    console.log(`Info: Block with index ${generatedBlock.index} added for ${previousMessage.recepient}`);

                    /**
                     * We send a response about the successful addition of the block
                     * with a slight delay
                     */
                    blockchain.broadcastMessage({
                        type: 'thrusted_block_add',
                        timestamp: previousMessage.timestamp,
                        block: generatedBlock,
                    }, 'AddedBlock', 'thrusted_node', blockchain.config.recieverAddress, 0);
                })
            }, null, previousMessage.timestamp, false);
        }
    }
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
            }, 100);
        } else {
            blockchain.getLatestBlock((previousBlock) => {
                if(!previousBlock) {
                    return;
                }

                if (block.previousHash === previousBlock.hash) {
                    blockchain.addBlock(block, () => {
                        // console.log('Added block', block.index);
                    })
                }
            });
        }
    }
}

function handlerValidator(message, cb) {
    if (storj.get('chainResponseMutex') || storj.get('syncInProgress')) {
        setTimeout(() => cb(message), 100);
        return;
    }

    // console.log('Message handler validator', message.id);

    return cb(message);
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

    starwave.registerMessageHandler('SelectAddBlock', (message) => handlerValidator(message, handleMessageSelectAddBlock));
    starwave.registerMessageHandler('SelectAddBlockCB', (message) => handlerValidator(message, handleMessageSelectAddBlockCB));
    starwave.registerMessageHandler('AddBlock', (message) => handlerValidator(message, handleMessageAddBlock));
    starwave.registerMessageHandler('AddedBlock', (message) => handlerValidator(message, handleMessageAddedBlock));

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