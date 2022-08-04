/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */


/**
 Starwave Protocol
 The protocol uses the BlockChain object and its message sending methods: blockchain.broadcast, blockchain.write
 added a new message type SW_BROADCAST - this is the type that the messages of this protocol use
 Message structure based on BlockChain initmessage, but additional fields added:
 * @param relevancyTime //message lifetime in ms
 * @param route // the route the message went through
 * @param timestampOfStart //time of the initial sending of the message from which the lifetime is counted
 *
 * a route is considered complete if the end element of the route array is equal to the recipient of the message
 * the route is recorded in full: from the sender to the recipient
 */

const MESSAGE_MUTEX_TIMEOUT = 1000;
const LATENCY_TIME = 2 * 1000; //rejection for message obsolescence

const BROADCAST_TYPE = "broadcast";

const storj = require('./instanceStorage');
const moment = require('moment');
const getid = require('./getid');

class starwaveProtocol {

    constructor(config, blockchain) {
        this.config = config;
        this.blockchain = blockchain;
        /**
         * Input message mutex
         * @type {{}}
         * @private
         */
        this._messageMutex = {};
        storj.put('starwaveProtocol', this);
        console.log('------------------', 'starwave address', this.config.recieverAddress);
    }

    /**
     * Creates message
     * @param data
     * @param reciver
     * @param sender
     * @param id
     * @param timestamp
     * @param TTL
     * @param relevancyTime
     * @param route
     * @param type
     * @param timestampOfStart
     * @param {string} broadcastId
     * @returns {{data: *, reciver: *, sender: *, id: *, timestamp: number, TTL: number, index: *, mutex: string, relevancyTime: Array, route: Array, type: number, timestampOfStart: number}}
     */
    createMessage(data, reciver, sender, id, timestamp, TTL, relevancyTime, route, type, timestampOfStart, broadcastId = '') {
        return {
            data: data,
            reciver: reciver,
            sender: sender !== undefined ? sender : this.config.recieverAddress,
            id: id,
            timestamp: timestamp !== undefined ? timestamp : moment().utc().valueOf(), //when forwarding messages. if the time is specified, then the message is forwarded and we leave the original creation time
            TTL: typeof TTL !== 'undefined' ? TTL : 0, //number of jumps of the
            mutex: getid() + getid() + getid(),
            relevancyTime: relevancyTime !== undefined ? relevancyTime : LATENCY_TIME, // the time of relevance of messages
            route: route !== undefined ? route : [],     //message route
            type: type !== undefined ? type : this.blockchain.MessageType.SW_BROADCAST,
            timestampOfStart: timestampOfStart !== undefined ? timestampOfStart : moment().utc().valueOf(),
            broadcastId
        };
    };

    /**
     * Register message handler
     * @param {string} message
     * @param {function|string} broadcastId
     * @param {function} handler
     * @return {boolean}
     */
    registerMessageHandler(message, broadcastId = '', handler = null) {
        let that = this;

        //for legacy methods
        if (typeof broadcastId === 'function' && !handler) {
            handler = broadcastId;
        }

        if (typeof that.blockchain !== 'undefined') {
            this.blockchain.registerMessageHandler(message, function (messageBody) {
                if (
                    messageBody.id === message
                    || (typeof broadcastId === 'string' && message === BROADCAST_TYPE && messageBody.broadcastId === broadcastId)
                ) {
                    if (typeof messageBody.mutex !== 'undefined' && typeof that._messageMutex[messageBody.mutex] === 'undefined') {
                        if (handler(messageBody)) {
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
     * Sends a message to a directly connected peer (by its busAddress)
     * @param messageBusAddress
     * @param {object} message
     */
    sendMessageToPeer(messageBusAddress, message) {
        let that = this;
        if(typeof that.blockchain !== 'undefined') {
            console.log('messageBusAddress', messageBusAddress, this.getAddress());
            if(messageBusAddress === this.getAddress()) { //message to yourself
                this.handleMessage(message, this.blockchain.messagesHandlers, null);
                return true;
            } else {
                console.log('getSocketByBusAddress', messageBusAddress);
                let socket = this.blockchain.getSocketByBusAddress(messageBusAddress);

                if(!socket) {  //there is no such connected socket
                    console.log('socket not found');
                    return false;
                } else {
                    console.log('socket FOUND')
                    //adding your address to the routes if the route is not completed
                    const routeIsComplete = !this.routeIsComplete(message);
                    console.log('routeIsComplete', routeIsComplete);
                    if (message.route.includes(this.config.recieverAddress) || message.route.length > 10) {
                        console.log('Dupe routes')
                        return false;
                    }
                    
                    if(routeIsComplete) {
                        message.route.push(this.config.recieverAddress);
                    }
                    //sending a message
                    that.blockchain.write(socket, message);
                    this.handleMessageMutex(message);
                    return true; //message has been sent
                }
            }

        }
    };

    /**
     * Sends a broadcast message through the system to everyone except the sender (if a flag is specified)
     * @param {object} message
     */
    broadcastMessage(message) {
        let that = this;
        //note on the task: If the route is empty OR if there are no known recipients in the route (except for the sender), messages are sent to everyone except the sender
        //if empty, then the first sending goes to everyone
        if(typeof that.blockchain !== 'undefined') {
            let prevSender; //the sender of the message
            if(message.route.length > 0) { //if the route array is empty, it means that this is the first sending of the message and you need to send it without restrictions
                //save the previous sender (he is recorded last in the array of routes)
                if (message.route.includes(this.config.recieverAddress) || message.route.length > 10) {
                    console.log('Dupe routes');
                    return;
                }
                prevSender = that.blockchain.getSocketByBusAddress(message.route[message.route.length - 1]);
            }
            //adding your address to routes
            message.route.push(this.config.recieverAddress);
            //setting the message type
            message.type = this.blockchain.MessageType.SW_BROADCAST;
            //send it to everyone except the sender (if this is not the first shipment)
            that.blockchain.broadcast(message, prevSender);
            this.handleMessageMutex(message);
        }
    };

    /**
     *  sends a message over the starwave protocol
     * @param message //message object
     */
    sendMessage(message) {
        const send = !this.sendMessageToPeer(message.reciver, message);
        console.log('this.sendMessageToPeer', send)
        if(send) {       //it was not possible to send directly, there is no directly connected peer, we make a newsletter to everyone
            //, we clear the route, starting from the current node
            this.broadcastMessage(message);
            console.log('return', 2);
            return 2; //sent broadcast
        }
        console.log('return', 1);
        return 1; //sent directly
    };

    /**
     * analyze the incoming message and see what to do with it next
     * @param message
     * @returns {*}
     */
    manageIncomingMessage(message) {

        //message from myself
        if(message.sender === this.getAddress()) {
            try { //An attempt to disconnect from yourself
                message._socket.close();
            } catch (e) {
            }
            return 0;
        }

        //checking the relevance of the message
        if((moment().utc().valueOf()) > (message.timestamp + message.relevancyTime + LATENCY_TIME)) {
            return 0; //ignore the message
        }
        //checking if the message has reached the endpoint
        if(this.endpointForMessage(message)) {
            //saving the route map
            if(message.route.length > 1) { //if the route map consists of one element, then there is a direct connection to the sender and there is no need to record
                message.route.push(this.config.recieverAddress);//flipping the array to use it for sending
                this.blockchain.routes[message.sender] = message.route.reverse().filter((v, i, a) => a.indexOf(v) === i);
            }
            return 1;   //a sign that the message has reached the goal
        } else {        //if the message is passing
            return this.retranslateMessage(message);
        }
        //the message is relevant and has not reached the recipient, so
        //we check for looping. if the route already has this address, and the endpoint has not yet been found, then we do not let it go further
        //, see the description above
        /* if(!this.routeIsComplete(message) &&
             (message.route.indexOf(this.config.recieverAddress) > -1)) {
             return 0;                           //that is, the route array is still under construction, and we received the message again
         }*/
    };

    /**
     * forward the received message further along the route
     * @param message
     * @returns {*} sent message
     */
    retranslateMessage(message) {
        //re-create the message (if you need to add something)
        let newMessage = message;
        if(this.routeIsComplete(newMessage)) {
            let ind = newMessage.route.indexOf(this.config.recieverAddress); // index of the current node in the route map
            if(!this.sendMessageToPeer(newMessage.route[ind + 1], newMessage)) { //it was not possible to send directly, there is no directly connected peer, we send a newsletter to everyone
                //, we clear the route, starting from the current node, because the route is broken and we rebuild it
                newMessage.route = newMessage.route.splice(ind);
                this.broadcastMessage(newMessage);
            }
        } else {//if the route is not completed
            this.sendMessage(newMessage);
        }
        return newMessage;
    };

    /**
     * full processing of the message according to the protocol
     * @param message
     * @param messagesHandlers
     * @param ws
     * @returns {*} //returns the index of the processed message
     */
    handleMessage(message, messagesHandlers, ws) {
        if(message.type === this.blockchain.MessageType.SW_BROADCAST) {
            if(this.manageIncomingMessage(message) === 1) {
                //this means that the message has arrived at the endpoint and
                //we decrypt it first, if necessary
                // this.starwaveCrypto.handleIncomingMessage(message);
                /**
                 * Let's go through the incoming message handlers
                 */

                for (let a in messagesHandlers) {
                    if(messagesHandlers.hasOwnProperty(a)) {
                        message._socket = ws;
                        if(messagesHandlers[a].handle(message)) {
                            return message.id; //If the message is processed, exit
                        }
                    }
                }
            }
        }
    }

    /**
     * working with the message mutex
     * @param messageBody
     */
    handleMessageMutex(messageBody) {
        //taken from the dispatcher
        this._messageMutex[messageBody.mutex] = true;
        setTimeout(() => {
            if(typeof this._messageMutex[messageBody.mutex] !== 'undefined') {
                delete this._messageMutex[messageBody.mutex];
            }
        }, MESSAGE_MUTEX_TIMEOUT);
    };

    /**
     * check whether our server is the recipient of the message
     * @param message
     * @returns {boolean}
     */
    endpointForMessage(message) {
        return message.reciver === this.config.recieverAddress;
    };

    /**
     * checks if the route is finished
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
        return this.blockchain.config.recieverAddress;
    };

    /**
     * close connection with socket if there are more then one url on that busaddress
     * @param socket
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
        const sockets = this.blockchain.getCurrentPeers(true);
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

module.exports = starwaveProtocol;
