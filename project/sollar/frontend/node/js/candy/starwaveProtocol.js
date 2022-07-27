/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */

/**
 * moment js required
 * @type {number}
 */
'use strict';
const MESSAGE_MUTEX_TIMEOUT = 1000;
const LATENCY_TIME = 100 * 1000; //time on obsolescence of message

const BROADCAST_TYPE = "broadcast";

//unify browser and node
if(typeof _this === 'undefined') {
    var _this = this;
}

/**
 * StarWave Protocol
 * StarWave is a self-configurable hi-speed messages interaction protocol
 */
class starwaveProtocol {

    constructor(candy, messageType) {
        this.candy = candy;
        this.candy.MessageType = messageType;

        /**
         * Input message mutex
         * @type {{}}
         * @private
         */
        this._messageMutex = {};
        if(_this.window === undefined) {
            this.moment = require('moment');
        } else {
            this.moment = moment;
        }
    }

    /**
     * Create message of starwave type
     * @param {object} data Message Data
     * @param {string} reciver Receiver address
     * @param {string} sender Sender address
     * @param {string} id Message id
     * @param {number} timestamp Message timestamp
     * @param {number} TTL Message TTL
     * @param {number} relevancyTime Message lifetime
     * @param {object} route Routes object
     * @param {number} type Messages type
     * @param {number} timestampOfStart Initial message timestamp
     * @param {string} broadcastId Broadcast string
     * @returns {{data: *, reciver: *, sender: *, id: *, timestamp: number, TTL: number, index: *, mutex: string, relevancyTime: Array, route: Array, type: number, timestampOfStart: number}}
     */
    createMessage(data, reciver, sender, id, timestamp, TTL, relevancyTime, route, type, timestampOfStart, broadcastId = '') {
        return {
            data: data,
            reciver: reciver,
            sender: sender !== undefined ? sender : this.candy.recieverAddress,
            id: id,
            timestamp: timestamp !== undefined ? timestamp : this.moment().utc().valueOf(),
            TTL: typeof TTL !== 'undefined' ? TTL : 0,
            mutex: this.candy.getid() + this.candy.getid() + this.candy.getid(),
            relevancyTime: relevancyTime !== undefined ? relevancyTime : LATENCY_TIME, //time of message's relevancy
            route: route !== undefined ? route : [],
            type: type !== undefined ? type : this.candy.MessageType.SW_BROADCAST,
            timestampOfStart: timestampOfStart !== undefined ? timestampOfStart : this.moment().utc().valueOf(),
            broadcastId
        };
    };

    /**
     * Register message handler
     * @param {string} message Message ID
     * @param {string|function} broadcastId - broadcastId or handler function
     * @param {function|null} handler Handler function
     * @return {boolean}
     */
    registerMessageHandler(message, broadcastId = '', handler = null) {
        let that = this;

        //for legacy methods
        if (typeof broadcastId === 'function' && !handler) {
            handler = broadcastId;
        }

        if (typeof that.candy !== 'undefined') {
            this.candy.registerMessageHandler(message, function (messageBody) {
                if (
                    messageBody.id === message
                    || (typeof broadcastId === 'string' && message === BROADCAST_TYPE && messageBody.broadcastId === broadcastId)
                ) {
                    if (typeof messageBody.mutex !== 'undefined' && typeof that._messageMutex[messageBody.mutex] === 'undefined') {
                        if (handler(messageBody) !== false) {
                            that.handleMessageMutex(messageBody);
                            if (messageBody.broadcastId === broadcastId) {
                                return false;
                            }
                            return true;
                        } else {
                            return false;
                        }
                    }
                }
            });
            return true;
        }
        return false;
    };


    /**
     * Send message to peer directly(using busAddress)
     * @param {string} messageBusAddress Receiver address
     * @param {object} message Message object
     */
    sendMessageToPeer(messageBusAddress, message) {
        let that = this;
        if(typeof that.candy !== 'undefined') {

            if(messageBusAddress === this.getAddress()) { //message to yourself
                this.handleMessage(message, this.candy.messagesHandlers, null);
                return true;
            } else {
                let socket = this.getSocketByBusAddress(messageBusAddress);

                if(!socket || socket.readyState === 0) {  //no such connected socket
                    return false;
                } else {
                    //add this node address if the route isn't complete
                    if(!this.routeIsComplete(message)) {
                        message.route.push(this.candy.recieverAddress);
                    }
                    //send the message
                    this.write(socket, message);
                    this.handleMessageMutex(message);
                    return true; //message has been sended
                }
            }

        }
    };

    /**
     * Send broadcasting messages to all peers excluding previous sender
     * @param {object} message
     */
    broadcastMessage(message) {
        let that = this;
        //if the route is empty then it is the first sending and we send it to all
        if(typeof that.candy !== 'undefined') {
            let prevSender; //previous sender og the message
            if(message.route.length > 0) { //if the route is empty then it's the first sending of the message and we send it to all connected peers without exclusions
                //saving previous sender (last element in route array)
                prevSender = that.getSocketByBusAddress(message.route[message.route.length - 1]);
            }
            //adding our address to route
            message.route.push(this.candy.recieverAddress);
            //set message type
            message.type = this.candy.MessageType.SW_BROADCAST;
            //send to all except previous sender(if it's not the first sending)
            this.broadcast(message, prevSender);
            this.handleMessageMutex(message);
        }
    };

    /**
     * Send message using StarWave protocol
     * @param {object} message Message object
     */
    sendMessage(message) {
        if(!this.sendMessageToPeer(message.reciver, message)) {   //can't send directly, no such connected peer, then send to all
            //clear route starting from our address
            this.broadcastMessage(message);
            return 2; //sended broadcast
        }
        return 1; //sended directly to peer
    };

    /**
     * Disassemble incoming message and decide what we should do with it
     * @param {object} message
     * @returns {Boolean}
     */
    manageIncomingMessage(message) {

        //message from ourselves
        if(message.sender === this.getAddress()) {
            try { //trying to close connection
                this.getSocketByBusAddress(message.sender).close();
            } catch (e) {
            }
            return 0;
        }

        //check if the message is't too old
        let m = this.moment().utc().valueOf();
        if(m > (message.timestamp + message.relevancyTime + LATENCY_TIME)) {
            return 0; //do nothing
        }
        //is it an endpoint of the message
        if(this.endpointForMessage(message)) {
            //save the route
            if(message.route.length > 1) { //if the route consist of the only element we don't save the route becase of direct connection to peer
                message.route.push(this.candy.recieverAddress);//reverse the route to use it in future sendings
                this.candy.routes[message.sender] = message.route.reverse().filter((v, i, a) => a.indexOf(v) === i);
            }
            return 1;   //message delivered
        } else {        //if the message shoud be forwarded
            //there should be foreward processing
            return 0;
        }
    };

    /**
     * Retranslate incoming message
     * @param message
     * @returns {*} sended message
     * @private
     */
    retranslateMessage(message) {
        //change some information in message
        let newMessage = message;
        if(this.routeIsComplete(newMessage)) {
            let ind = newMessage.route.indexOf(this.candy.recieverAddress); // find index of this node in route array
            if(!this.sendMessageToPeer(newMessage.route[ind + 1], newMessage)) {  //can't send directly, no such connected peer, then send to all
                //clear route starting from our address because the toute is wrong and we should rebuild it
                newMessage.route = newMessage.route.splice(ind);
                this.broadcastMessage(newMessage);
            }
        } else {//if the route isn't complete
            this.sendMessage(newMessage);
        }
        return newMessage;
    };

    /**
     * Full message processing according to the Protocol
     * @private
     * @param message
     * @param messagesHandlers
     * @param ws
     * @returns {*} //id of processed message
     */
    handleMessage(message, messagesHandlers, ws) {
        if(message.type === this.candy.MessageType.SW_BROADCAST) {
            if(this.manageIncomingMessage(message) === 1) {
                //this.starwaveCrypto.handleIncomingMessage(message);
                //message is on the endpoint and we execute handlers
                for (let a in messagesHandlers) {
                    if(messagesHandlers.hasOwnProperty(a)) {
                        message._socket = ws;
                        if(messagesHandlers[a].handle(message)) {
                            return message.id; //if the message is processed we return
                        }
                    }
                }
            }
        }
    }

    /**
     * Process the message mutex
     * @private
     * @param messageBody
     */
    handleMessageMutex(messageBody) {
        this._messageMutex[messageBody.mutex] = true;
        setTimeout(() => {
            if(typeof this._messageMutex[messageBody.mutex] !== 'undefined') {
                delete this._messageMutex[messageBody.mutex];
            }
        }, MESSAGE_MUTEX_TIMEOUT);
    };

    /**
     * Check if our node is the reciver
     * @private
     * @param message
     * @returns {boolean}
     */
    endpointForMessage(message) {
        return message.reciver === this.candy.recieverAddress;
    };

    /**
     * Check if our route is complete
     * @private
     * @param message
     * @returns {boolean}
     */
    routeIsComplete(message) {
        return (message.route[message.route.length - 1] === message.reciver);
    };

    /**
     * Returns address
     * @return {string}
     */
    getAddress() {
        return this.candy.recieverAddress;
    };

    /**
     * Write to socket
     * @param ws
     * @param message
     */
    write(ws, message) {
        try {
            ws.send(JSON.stringify(message))
        } catch (e) { //send error. it's possibly that socket is inactive
            console.log('Send error: ' + e);
        }
    }

    /**
     * Get the list of connected peers(sockets)
     * @returns {Array}
     */
    getCurrentPeers(fullSockets) {
        return this.candy.sockets.map(function (s) {
            if(s && s.readyState === 1) {
                if(fullSockets) {
                    return s;
                } else {
                    return 'ws://' + s._socket.remoteAddress + ':' + /*s._socket.remotePort*/ config.p2pPort
                }
            }
        }).filter((v, i, a) => a.indexOf(v) === i);
    }

    /**
     * find socket using bus address
     * @param address
     * @return {*}
     */
    getSocketByBusAddress(address) {
        const sockets = this.getCurrentPeers(true);
        for (let i in sockets) {
            if(sockets.hasOwnProperty(i)) {
                if(sockets[i] && sockets[i].nodeMetaInfo) {
                    if(sockets[i].nodeMetaInfo.messageBusAddress === address) {
                        return sockets[i];
                    }
                }
            }
        }

        return false;
    }

    /**
     * Broadcast message
     * @private
     * @param message
     * @param excludeIp
     */
    broadcast(message, excludeIp) {
        let i;
        for (i = 0; i < this.candy.sockets.length; i++) {
            let socket = this.candy.sockets[i];
            if(socket.readyState !== 0) {
                if(typeof excludeIp === 'undefined' || socket !== excludeIp) {
                    this.write(socket, message);
                } else {

                }
            }
        }
    }

    /**
     * close connection with socket if there are more then one url on that busaddress
     * @private
     * @returns {number} //status of the operation
     */
    preventMultipleSockets(socket) {
        let busAddress;
        if(socket.nodeMetaInfo) {
            busAddress = socket.nodeMetaInfo.messageBusAddress;
            if(busAddress === undefined) {
                return 2; //socket without busAddress
            }
        } else {
            return 3; //socket has no meta info
        }
        //if there are more than 1 socket on busaddress we close connection
        const sockets = this.getCurrentPeers(true);
        let socketsOnBus = 0;
        const socketsNumber = sockets.length;
        for (let i = 0; i < socketsNumber; i++) {
            if(sockets[i] && sockets[i].nodeMetaInfo) {
                if(sockets[i].nodeMetaInfo.messageBusAddress === busAddress) {
                    socketsOnBus++;
                }
            }
        }
        if(socketsOnBus > 1) {
            socket.close();
            return 0; //close connection
        } else {
            return 1; // no other connections
        }
    }

}

//unify browser and node
if(this.window === undefined) {
    module.exports = starwaveProtocol;
}
