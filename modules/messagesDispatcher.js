/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */

const MESSAGE_MUTEX_TIMEOUT = 1000;
const RESPONSE_SUFFIX = '_RESP';

const storj = require('./instanceStorage');

class MessagesDispatcher {

    constructor(config, blockchain) {
        this.config = config;
        this.blockchain = blockchain;
        /**
         * Input message mutex
         * @type {{}}
         * @private
         */
        this._messageMutex = {};

        this._waitingMessages = {};
        this.RESPONSE_SUFFIX = RESPONSE_SUFFIX;

        storj.put('messagesDispatcher', this);
    }


    /**
     * Register message handler
     * @param {string} message
     * @param {function} handler
     * @return {boolean}
     */
    registerMessageHandler(message, handler) {
        let that = this;

        if(typeof that.blockchain !== 'undefined') {
            this.blockchain.registerMessageHandler(message, function (messageBody) {
                if(messageBody.id === message || message.length === 0) {
                    if(typeof  messageBody.mutex !== 'undefined' && typeof that._messageMutex[messageBody.mutex] === 'undefined') {
                        handler(messageBody, function (data) {
                            that.broadcastMessage(data, message + RESPONSE_SUFFIX, messageBody.recepient);
                        });
                        that._messageMutex[messageBody.mutex] = true;
                        setTimeout(function () {
                            if(typeof that._messageMutex[messageBody.mutex] !== 'undefined') {
                                delete that._messageMutex[messageBody.mutex];
                            }
                        }, MESSAGE_MUTEX_TIMEOUT);
                    }
                }
            });
            return true;
        }

        return false;
    }

    /**
     * Broadcast message
     * @param {object} data
     * @param {string} message
     * @param {string} receiver
     */
    broadcastMessage(data, message, receiver) {
        let that = this;

        if(typeof that.blockchain !== 'undefined') {
            let messageBody = that.blockchain.broadcastMessage(data, message, receiver, that.getAddress());
            that._messageMutex[messageBody.mutex] = true;
            setTimeout(function () {
                if(typeof that._messageMutex[messageBody.mutex] !== 'undefined') {
                    delete that._messageMutex[messageBody.mutex];
                }
            }, MESSAGE_MUTEX_TIMEOUT);
        }
    }

    /**
     * Send message directly to socket
     * @param socket
     * @param {object} data
     * @param {string} message
     * @param {string} receiver
     */
    sendMessage(socket, data, message, receiver) {
        let that = this;
        if(typeof that.blockchain !== 'undefined') {
            let messageBody = that.blockchain.createMessage(data, receiver, that.getAddress(), message, that.blockchain.lastMsgIndex + 1);
            that.blockchain.write(socket, messageBody);
            that._messageMutex[messageBody.mutex] = true;
            setTimeout(function () {
                if(typeof that._messageMutex[messageBody.mutex] !== 'undefined') {
                    delete that._messageMutex[messageBody.mutex];
                }
            }, MESSAGE_MUTEX_TIMEOUT);
        }
    }

    /**
     * @param data
     * @param message
     * @param recepient
     * @param timeout
     * @param cb
     */
    broadcastMessageWaitResponse(data, message, recepient, timeout, cb) {
        let that = this;

        that.registerMessageHandler(message + RESPONSE_SUFFIX, function (messageBody) {
            if(messageBody.reciver === that.getAddress()) {
                cb(null, messageBody);
            }
        });

        setTimeout(function () {
            cb('timeout');
        }, timeout);

        that.broadcastMessage(data, message, recepient);

    }

    /**
     * Returns address
     * @return {string}
     */
    getAddress() {
        return this.blockchain.config.recieverAddress;
    }

}

module.exports = MessagesDispatcher;
