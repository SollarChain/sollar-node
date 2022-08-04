/**
 * Candy
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */

/**
 * required nodemetainfo
 */

'use strict';
//unify browser and node
if(typeof _this === 'undefined') {
    var _this = this;
}

const MessageType = {
    QUERY_LATEST: 0,
    QUERY_ALL: 1,
    RESPONSE_BLOCKCHAIN: 2,
    MY_PEERS: 3,
    BROADCAST: 4,
    META: 5,
    SW_BROADCAST: 6
};

const MAX_CONNECTIONS = 30;

const BlockchainRequestors = {
    queryAllMsg: function (fromIndex, limit) {
        limit = typeof limit === 'undefined' ? 1 : limit;
        return {'type': MessageType.QUERY_ALL, data: typeof fromIndex === 'undefined' ? 0 : fromIndex, limit: limit}
    }
};


function Candy(nodeList) {

    //modules list(for compability with node)
    try {
        if(_this.window === undefined) {
            this.WebSocket = require('ws');
            this.starwaveProtocol = require('./starwaveProtocol.js');
            this.NodeMetaInfo = require('./NodeMetaInfo.js');
            this.DigitalSignature = require('./digitalSignature.js');
            this.StarwaveCrypto = require('./starwaveCrypto.js');
            this.URL = require('url').Url;
        } else { //if browser
            this.WebSocket = typeof WebSocket !== 'undefined' ? WebSocket : undefined;
            this.starwaveProtocol = typeof starwaveProtocol !== 'undefined' ? starwaveProtocol : undefined;
            this.NodeMetaInfo = typeof NodeMetaInfo !== 'undefined' ? NodeMetaInfo : undefined;
            this.DigitalSignature = typeof DigitalSignature !== 'undefined' ? DigitalSignature : undefined;
            this.StarwaveCrypto = typeof StarwaveCrypto !== 'undefined' ? StarwaveCrypto : undefined;
            this.URL = URL;
        }
    } catch (e) {
        console.log('Error trying to include libraries: ' + e);
    }

    let that = this;

    this._resourceQueue = {};
    this._lastMsgTimestamp = 0;
    this._lastMsgIndex = 0;
    this._requestQueue = {};
    this._autoloader = undefined;

    /**
     * Max connections
     * @type {number}
     */
    this.maxConnections = MAX_CONNECTIONS;

    /**
     * Nodes list
     */
    this.nodeList = nodeList;

    /**
     * All sockets list
     * @type {Array}
     */
    this.sockets = [];

    /**
     * Blockchain height
     * @type {number}
     */
    this.blockHeight = 0;

    /**
     * Generate uniq id string
     * @return {string}
     */
    this.getid = () => (Math.random() * (new Date().getTime())).toString(36).replace(/[^a-z]+/g, '');

    /**
     * Messages handlers
     * @type {Array}
     */
    this.messagesHandlers = [];

    /**
     * Known routes
     * @type {{}}
     */
    this.routes = {};

    /**
     * Allows multiple connections from one bus address
     * if TRUE we don't check
     * @type {boolean}
     */
    this.allowMultiplySocketsOnBus = false;

    /**
     * Known secret keys
     * consist of secret keys of different busAddresses of peers
     * @type {{}}
     */
    this.secretKeys = {};

    if(typeof this.starwaveProtocol === 'function') {
        this.starwave = new this.starwaveProtocol(this, MessageType);
    } else {
        console.log("Error: Can't find starwaveProtocol module");
    }

    /**
     * Current reciever address. Override allowed
     * @type {string}
     */
    this.recieverAddress = this.getid() + this.getid();

    /**
     * On data recived callback
     * @param {String} data
     */
    this.ondata = function (data) {
        return false;
    };

    /**
     * On blockchain connection ready
     */
    this.onready = function () {

    };

    /**
     * If message recived
     * @param {object} message
     */
    this.onmessage = function (message) {

    };


    /**
     * Internal data handler
     * @param {WebSocket} source
     * @param {Object} data
     * @private
     */
    this._dataRecieved = function (source, data) {
        //prevent multiple sockets on one busaddress
        if(!this.allowMultiplySocketsOnBus && (this.starwave)) {
            if(this.starwave.preventMultipleSockets(source) === 0) {
                data = null;
                return;
            }
        }

        if(typeof that.ondata === 'function') {
            if(that.ondata(data)) {
                return;
            }
        }

        //Data block recived
        if(data.type === MessageType.RESPONSE_BLOCKCHAIN) {
            try {
                /**
                 * @var {Block} block
                 */
                let blocks = JSON.parse(data.data);
                for (let a in blocks) {
                    let block = blocks[a];
                    if(that.blockHeight < block.index) {
                        that.blockHeight = block.index
                    }
                    //Loading requested resource
                    if(typeof that._resourceQueue[block.index] !== 'undefined') {
                        that._resourceQueue[block.index](block.data, block);
                        that._resourceQueue[block.index] = undefined;
                    }
                }

            } catch (e) {
            }
        }

        //New peers recived
        if(data.type === MessageType.MY_PEERS) {
            for (let a in data.data) {
                if(data.data.hasOwnProperty(a)) {
                    if(that.nodeList.indexOf(data.data[a]) == -1) {
                        that.nodeList.push(data.data[a]);
                        if(that.getActiveConnections().length < that.maxConnections - 1) {
                            that.connectPeer(data.data[a]);
                        }
                    }
                }
            }
            that.nodeList = Array.from(new Set(that.nodeList));
        }

        if(data.type === MessageType.BROADCAST) {
            /*if(that._lastMsgIndex < data.index) {*/
            if(data.reciver === that.recieverAddress) {

                if(data.id === 'CANDY_APP_RESPONSE') {
                    if(typeof that._candyAppResponse === 'function') {
                        that._candyAppResponse(data);
                    }
                } else {
                    if(typeof that.onmessage === 'function') {
                        that.onmessage(data);
                    }
                }
            } else {
                if(data.recepient !== that.recieverAddress) {
                    data.TTL++;
                }
            }
            /*}*/
            that._lastMsgIndex = data.index;
            that._lastMsgTimestamp = data.timestamp;
        }

        //add meta info handling //required NodeMetaInfo.js included
        if(data.type === MessageType.META) {
            if(typeof this.NodeMetaInfo === 'function') {
                let ind = that.sockets.indexOf(source);
                if(ind > -1) {
                    that.sockets[ind].nodeMetaInfo = (new this.NodeMetaInfo()).parse(data.data);
                } else {
                    console.log('Error: Unexpected error occurred when trying to add validators');
                }
            } else {
                console.log('Error: NodeMetaInfo.js has not been included');
            }
        }

        if(data.type === MessageType.SW_BROADCAST) {
            if(this.starwave) {
                this._lastMsgIndex = this.starwave.handleMessage(data, this.messagesHandlers, source);
            }
        }

    };


    /**
     * Returns array of connected sockets
     * @return {Array}
     */
    that.getActiveConnections = function () {
        let activeSockets = [];
        for (let a in that.sockets) {
            if(that.sockets[a]) {
                if(that.sockets[a].readyState === this.WebSocket.OPEN) {
                    activeSockets.push(that.sockets[a]);
                }
            }
        }

        return activeSockets;
    };

    /**
     * Inits peer connection
     * @param {String} peer
     */
    this.connectPeer = function (peer) {
        let socket = null;
        try {
           for(let connection of that.getActiveConnections()){
               if(connection.url === peer){
                   return;
               }
           }
            socket = new this.WebSocket(peer);
        } catch (e) {
            return;
        }

        socket.onopen = function () {
            setTimeout(function () {
                if(typeof that.onready !== 'undefined') {
                    if(typeof that._autoloader !== 'undefined') {
                        that._autoloader.onready();
                    }
                    that.onready();
                    that.onready = undefined;
                }
            }, 10);
        };

        socket.onclose = function (event) {
            that.sockets.splice(that.sockets.indexOf(event.socket), 1);
            // that.sockets[that.sockets.indexOf(socket)] = null;
            // delete that.sockets[that.sockets.indexOf(socket)];
        };

        socket.onmessage = function (event) {
            try {
                let data = JSON.parse(event.data);
                that._dataRecieved(socket, data);
            } catch (e) {
            }
        };

        socket.onerror = function (error) {
            //console.log("Ошибка " + error.message);
        };
        if(_this.window === undefined) {
            socket.on('open', () => socket.onopen());
            socket.on('close', () => socket.onclose);
            socket.on('message', () => socket.onmessage());
            socket.on('error', () => socket.onerror);
        }
        that.sockets.push(socket);
    };

    /**
     * Broadcast message to peers
     * @param message
     * @return {boolean} sending status
     */
    this.broadcast = function (message) {
        let sended = false;
        if(typeof message !== 'string') {
            message = JSON.stringify(message);
        }
        for (let a in that.sockets) {
            if(that.sockets.hasOwnProperty(a) && that.sockets[a] !== null) {
                try {
                    that.sockets[a].send(message);
                    sended = true;
                } catch (e) {
                }
            }
        }

        return sended;
    };


    /**
     * Broadcast global message
     * @param {object} messageData Message data
     * @param {string} id Message ID
     * @param {string} reciver Receiver address
     * @param {string} recipient Recipient address
     */
    this.broadcastMessage = function (messageData, id, reciver, recipient) {
        that._lastMsgIndex++;
        let message = {
            type: MessageType.BROADCAST,
            data: messageData,
            reciver: reciver,
            recepient: recipient,
            id: id,
            timestamp: (new Date().getTime()),
            TTL: 0,
            index: that._lastMsgIndex,
            mutex: this.getid() + this.getid() + this.getid()
        };
        if(!that.broadcast(message)) {
            that.autoconnect(true);
            return false;
        }

        return true;
    };

    /**
     * Reconnecting peers if fully disconnected
     * @param {boolean} force reconnection
     */
    this.autoconnect = function (force) {
        if(that.getActiveConnections().length < 1 || force) {
            for (let a in that.nodeList) {
                if(that.nodeList.hasOwnProperty(a)) {
                    if(that.getActiveConnections().length < that.maxConnections - 1) {
                        that.connectPeer(that.nodeList[a]);
                    }
                }
            }
        } else {
            that.sockets = Array.from(new Set(that.sockets));
            that.connections = that.getActiveConnections().length;
        }
    };

    /**
     * Starts connection to blockchain
     */
    this.start = function () {
        for (let a in that.nodeList) {
            if(that.nodeList.hasOwnProperty(a)) {
                if(that.getActiveConnections().length < that.maxConnections - 1) {
                    that.connectPeer(that.nodeList[a]);
                }
            }
        }
        setInterval(function () {
            that.autoconnect();
        }, 5000);

        return this;
    };

    /**
     * Makes RAW Candy Server Application request
     * @deprecated
     * @param {string} uri
     * @param requestData
     * @param {string} backId
     * @param {int} timeout
     * @private
     */
    this._candyAppRequest = function (uri, requestData, backId, timeout) {
        let url = new this.URL(uri.replace('candy:', 'http:'));
        let data = {
            uri: uri,
            data: requestData,
            backId: backId,
            timeout: timeout
        };
        this.broadcastMessage(data, 'CANDY_APP', url.host, that.recieverAddress);
    };

    /**
     * Response from Candy Server App
     * @param message
     * @private
     */
    this._candyAppResponse = function (message) {
        if(typeof that._requestQueue[message.data.backId] !== 'undefined') {
            let request = that._requestQueue[message.data.backId];
            clearTimeout(request.timer);
            request.callback(message.err, typeof message.data.data.body !== 'undefined' ? message.data.data.body : message.data.data, message);
            that._requestQueue[message.data.backId] = undefined;
            delete that._requestQueue[message.data.backId];
        }
    };


    /**
     * Creates request to app like $.ajax request
     * @deprecated
     * @param {string} uri
     * @param {object} data
     * @param {function} callback
     * @param {int} timeout
     */
    this.requestApp = function (uri, data, callback, timeout) {
        if(typeof timeout === 'undefined') {
            timeout = 10000;
        }
        let requestId = that.getid();

        let timer = setTimeout(function () {
            that._requestQueue[requestId].callback({error: 'Timeout', request: that._requestQueue[requestId]});
            that._requestQueue[requestId] = undefined;
        }, timeout);

        that._requestQueue[requestId] = {
            id: requestId,
            uri: uri,
            data: data,
            timeout: timeout,
            callback: callback,
            timer: timer
        };

        that._candyAppRequest(uri, data, requestId, timeout);

        return that._requestQueue[requestId];
    };

    /**
     * Universal request function.
     * For request data from vitamin chain use "block" as host name and bock id as path. Ex: candy://block/14
     * For application request use candy://hostname/filepath?get=query
     * Data and timeout ignored in block request
     * @param {string} uri Uri string
     * @param {object} data Data object
     * @param {function} callback Callback function
     * @param {int} timeout Request timeout (deprecated)
     */
    this.request = function (uri, data, callback, timeout) {
        let url = new this.URL(uri.replace('candy:', 'http:'));
        if(url.hostname === 'block') {
            that.loadResource(url.pathname.replace('/', ''), function (err, data) {
                callback(err, data.candyData, data);
            });
        } else {
            that.requestApp(uri, data, callback, timeout);
        }
    };


    /**
     * Load resource from blockchain
     * @param {Number} blockId Block index
     * @param {Function} callback Callback function
     */
    this.loadResource = function (blockId, callback) {
        if(blockId > that.blockHeigth && blockId < 1) {
            callback(404);
        }
        that._resourceQueue[blockId] = function (data, rawBlock) {
            callback(null, JSON.parse(data), rawBlock);
        };
        let message = BlockchainRequestors.queryAllMsg(blockId);
        that.broadcast(JSON.stringify(message));
    };


    /**
     * Add message handler
     * @param {string} id Message ID
     * @param {Function} handler Handler function
     */
    this.registerMessageHandler = function (id, handler) {
        this.messagesHandlers.push({id: id, handle: handler});
        this.messagesHandlers.sort((a, b) => a.id > b.id);
    };

    return this;
}

if(this.window === undefined) {
    module.exports = Candy;
}
