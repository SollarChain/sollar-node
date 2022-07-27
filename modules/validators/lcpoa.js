/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */

/**
 * LCPoA validator
 * LCPoA - is a Limited Confidence Proof-of-Activity
 * Somebody call this - Proof-of-Time
 * But I call him - the second wife.
 */

/**
 * Blockchain object
 * @type {Blockchain}
 */
let blockchain = null;

const Block = require('../block');
const Signable = require('../blocksModels/signable');

/**
 * Do we want to generate network support blocks:
 * @type {boolean}
 */
let generateEmptyBlocks = false;

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

    if(previousBlock.index + 1 !== newBlock.index) {
        console.log('Error: LCPoA: Invalid block index ' + newBlock.index);
        return false;
    } else if((previousBlock.hash !== newBlock.previousHash) || !isValidHash(newBlock.hash)) {
        console.log('Error: LCPoA: Invalid block previous hash or new hash in ' + newBlock.index);
        return false;
    } else if(!isValidHash(previousBlock.hash) && previousBlock.sign.length === 0) {
        console.log('Error: LCPoA: Invalid previous block hash');
        return false;
    } else if((blockchain.calculateHashForBlock(newBlock) !== newBlock.hash) || !isValidHash(newBlock.hash)) {
        console.log('Error: LCPoA: Invalid hash for block: ' + blockchain.calculateHashForBlock(newBlock) + ' ' + newBlock.hash);
        return false;
    } else if(newBlock.startTimestamp > newBlock.timestamp || previousBlock.timestamp > newBlock.timestamp) { //LCPoA time checking
        console.log('Error: LCPoA: Invalid start or block timestamp');
        return false;
    } else if(newBlock.timestamp > (moment().utc().valueOf() + 1000)) {
        console.log('Error: LCPoA: Invalid local time or block creator time');
        return false;
    } else if(String(newBlock.timestamp).length !== 13 || String(newBlock.startTimestamp).length !== 13) {
        console.log('Error: LCPoA: Invalid timestamp number');
        return false;
    }

    return true;
}

/**
 * Checking the block hash for validity
 * @param hash
 * @returns {boolean}
 */
function isValidHash(hash) {
    return blockchain.config.blockHashFilter.blockEndls.indexOf(hash.slice(-4)) !== -1;
}


/**
 * Mining a new LCPoA block
 * @param {Signable} blockData
 * @param {Function} cb
 * @param {Function} cancelCondition
 */
function generateNextBlock(blockData, cb, cancelCondition) {
    /*if(miningNow) {
     return;
     }*/

    if(typeof blockData === 'object') {
        blockData = JSON.stringify(blockData);
    }

    /*if(blockchain.config.program.disableMining){
        throw('Error: Mining disabled');
    }*/

    let nextHash = '';
    let nextTimestamp;
    console.log('Mining: Mining block...');
    blockchain.miningNow++;
    blockchain.setMiningForce(blockchain.miningNow, blockchain.miningForce);
    let mineCounter = 0;
    let lastHash = '';
    let lastTime = new Date().getTime() / 1000;
    let minerNo = blockchain.miningNow;
    let startTimestamp = moment().utc().valueOf();

    function tryMine() {
        if(typeof cancelCondition !== 'undefined') {
            if(cancelCondition()) { //If the check returned the need to turn off the miner
                console.log('Mining: Miner ' + minerNo + ' aborted');
                blockchain.miningNow--;
                return;
            }
        }
        blockchain.getLatestBlock(function (previousBlock) {
            if(!previousBlock) {
                //In this case, most likely the network is busy with synchronization, and it is necessary to postpone mining later
                setTimeout(tryMine, 5000);
            }
            const nextIndex = previousBlock.index + 1;
            nextTimestamp = moment().utc().valueOf();
            nextHash = blockchain.calculateHash(nextIndex, previousBlock.hash, nextTimestamp, blockData, startTimestamp, '');
            if(nextHash !== lastHash) {
                lastHash = nextHash;
                mineCounter++;
            }
            if((nextTimestamp / 1000) % 1 === 0) {
                blockchain.miningForce = (mineCounter / 1);
                blockchain.setMiningForce(blockchain.miningNow, blockchain.miningForce);
                console.log('Miner #' + minerNo + ': Speed ' + (mineCounter / 1) + ' H/s');
                lastTime = nextTimestamp / 1000;
                mineCounter = 0;
            }
            if(isValidHash(nextHash)) {
                console.log('Mining: New block found ' + nextHash);
                blockchain.miningNow--;
                blockchain.setMiningForce(blockchain.miningNow, blockchain.miningForce);

                cb(new Block(nextIndex, previousBlock.hash, nextTimestamp, blockData, nextHash, startTimestamp, ''));
            } else {
                setTimeout(tryMine, blockchain.config.lcpoaVariantTime);
            }
        });

    }

    setTimeout(tryMine, 1);

}

/**
 * Generates an empty block if there are no active transactions on the network
 */
function generateEmptyBlock(keyring) {

    if((blockchain.getCurrentPeers().length <= 2 || blockchain.miningNow > 0 || blockchain.blockHandler.syncInProgress) && !keyring) {
        return;
    }

    let lastMaxBlock = blockchain.maxBlock;

    blockchain.getLatestBlock(function (block) {
        if(moment().utc().valueOf() - block.timestamp > (blockchain.config.generateEmptyBlockDelay) || keyring) {
            let empty = new Signable();
            generateNextBlock(empty, function (generatedBlock) {
                //If someone has added a block during this time, then we do nothing
                blockchain.getLatestBlock(function (block) {
                    if(moment().utc().valueOf() - block.timestamp > (blockchain.config.generateEmptyBlockDelay) || keyring) {
                        if(isValidNewBlock(generatedBlock, block)) {
                            blockchain.addBlock(generatedBlock);
                        } else {
                            console.log('Error: LCPoA: We generate bad block :( ')
                        }
                        blockchain.broadcastLastBlock();

                    }
                });
            }, function () {
                return blockchain.maxBlock !== lastMaxBlock;
            });
        }
    });
}

/**
 * Checking whether we will generate a new empty block
 * @return {boolean}
 */
function generateEmptyBlockCheck() {
    if(blockchain !== 'null' && generateEmptyBlocks) {
        generateEmptyBlock();
    }
}


/**
 * Work is always possible
 * @return {boolean}
 */
function isReady() {
    if(blockchain.config.program.disableMining) {
        return false;
    }
    return true;
}

/**
 * Toggle empty blocks generation
 * @param generate
 */
function setGenerateEmptyBlocks(generate) {
    generateEmptyBlocks = generate;
    /*if(!generate){
        console.log('Info: LCPoA empty block generation disabled');
    }*/
}


module.exports = function (blockchainVar) {
    blockchain = blockchainVar;
    console.log('Info: LCPoA validator loaded');
    setInterval(generateEmptyBlockCheck, blockchain.config.emptyBlockInterval);
    return {
        consensusName: 'LCPoA',
        isValidNewBlock: isValidNewBlock,
        generateNextBlock: generateNextBlock,
        isValidHash: isValidHash,
        isReady: isReady,
        generateEmptyBlock: generateEmptyBlock,
        setGenerateEmptyBlocks: setGenerateEmptyBlocks,
    };
};

