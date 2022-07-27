/**
 * Module for asking and checking info about blockchain on connection
 *
 */
'use strict';

const logger = new (require('./logger'))('BlockchainInfo');

class BlockchainInfo {
    /**
     * initial initialization and parameter setting
     * @param blockchain
     */
    constructor(blockchain) {
        this.blockchain = blockchain;
        this.BLOCKCHAIN_INFO = 'BLOCKCHAIN_INFO'; //id for messages requesting information about the blockchain
        this.ASKING_TIMEOUT = 10000; //polling timeout of the last known block
    };

    /**
     * requesting information from a newly connected node and setting a polling timer
     * @param ws
     * @param sendFunction
     * @param timeout
     * @returns {number | *}
     */
    onConnection(ws, sendFunction, timeout = this.ASKING_TIMEOUT) {
        let message = {data: '', id: this.BLOCKCHAIN_INFO};//the data field is empty, so this is a data request from another node
        //send a request for information about the socket blockchain
        sendFunction(ws, message);
        //we set the polling interval for information about the last block
        //and bind the info object to the socket
        ws.blockchainInfoTimerID = setInterval(() => {
            sendFunction(ws, message);
        }, timeout);
        return ws.blockchainInfoTimerID;
    };

    /**
     * get and extract all the information about ourselves
     * @param blockchain
     */
    getOurBlockchainInfo(blockchain = this.blockchain) {
        //get the length of the entire chain
        let infoObject = {};
        infoObject['lastBlockInfo'] = {};
        let blockInfo = {};
        blockchain.getLatestBlock((val) => blockInfo = val);
        infoObject['lastBlockInfo'].blockchainLength = blockInfo.index + 1;
        infoObject['lastBlockInfo'].timestamp = blockInfo.timestamp;
        infoObject['lastBlockInfo'].hash = blockInfo.hash;
        infoObject['genesisHash'] = blockchain.getGenesisBlock().hash;
        return infoObject;
    }

    /**
     * send information about ourselves to the node that requested it
     * @param ws node address
     * @param sendFunction a function for sending a message
     * @param info information sent
     * @returns {*} //undefined in case of error and message in case of sending
     */
    sendOurInfo(ws, sendFunction, info = this.getOurBlockchainInfo()) {
        let data;
        try {
            data = JSON.stringify(info);
        } catch (e) {
            logger.error('Error creating JSON data' + e);
            return;
        }
        let message = {
            data: data,
            id: this.BLOCKCHAIN_INFO,
        };
        sendFunction(ws, message);
        return message;
    }

    /**
     * the handler of incoming messages with information about the blockchain
     * @param message
     * @param ws
     * @param lastBlockInfo
     * @param sendFunction
     * @returns {boolean}
     */
    handleIncomingMessage(message, ws, lastBlockInfo, sendFunction) {
        //check messages containing information about the blockchain
        if(message.id === this.BLOCKCHAIN_INFO) {
            if(message.data === '') {//if the date is empty, it means they are asking to send information about us
                this.sendOurInfo(ws, sendFunction);
                return true;
            } else {
                //the message is not empty, so it should contain information about the blockchain of the connected node
                let info;
                try {
                    info = JSON.parse(message.data);
                } catch (e) {
                    logger.error('' + e);
                    ws.haveBlockchainInfo = false; //slowing down message processing
                    return true;
                }
                //if the hashes do not match, then we disconnect
                if(info['genesisHash'] !== this.blockchain.getGenesisBlock().hash) {
                    logger.info('Genesis hashes are not equal. Socket will be disconnected.');
                    ws.haveBlockchainInfo = false; //slowing down message processing
                    clearInterval(ws.blockchainInfoTimerID); //turning off the questionnaire
                    ws.close();
                    message = null;
                    return true;
                } else {
                    ws.haveBlockchainInfo = true; //allow further processing of messages
                    //check the relevance of our information along the length of the chain (if another node has more, then we update the information)
                    if(lastBlockInfo.blockchainLength < info['lastBlockInfo'].blockchainLength) {
                        lastBlockInfo = info['lastBlockInfo'];
                    }
                    return true;
                }
            }
        } else {
            return false;
        }
    }
}

module.exports = BlockchainInfo;