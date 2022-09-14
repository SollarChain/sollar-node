#!/usr/bin/env node

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

'use strict';

const logger = new (require('./modules/logger'))();
const version = require('./package.json').version;
const _ = require('lodash');
let program = require('commander');

program
    .version(version)
    .description('Sollar - Sollar blockchain core.')
    .option('-a, --autofix', 'Fix saved chain if possible. WARNING: You can lose important data')
    .option('--clear', 'Clear all saved chain and deletes wallet. WARNING: You can lose important data')
    .option('--clear-db', 'Clear all saved chain and calculated wallets.')
    .option('-c, --config [path]', 'Core config path', 'config.json')
    .option('--write-config [path]', 'Save config in [path] file', false)
    .option('--work-dir [path]', 'Working directory', false)
    .option('--keyring-emission', 'Generate and deploy keyring', false)
    .option('--generate-wallets [keyring path]', 'Generate wallets from keyring file', false)
    .option('--new-chain', 'Starts new chain', false)
    .option('--fall-on-errors', 'Stops node with error code on uncaught exceptions', false)
    .option('--block-accept-count [count]', 'Number of blocks to confirm transaction')
    .option('--http-port [port]', 'Interface and RPC binding port')
    .option('--disable-rpc-password', 'Disable RPC password', false)
    .option('--disable-mining', 'Completely disables mining', false)
    .option('--fast-load', 'Don\'t checking saved blocks database on startup', false)
    .option('--verbose', 'More logging info', false)
    .option('--enable-address-rotation', 'Activates the rotation of the addresses', false)
    .option('--no-splash', 'Disable splash screen', false)
    .option('--leech-mode', 'Disable p2p server', false)
    .parse(process.argv);

const getid = require('./modules/getid');

let config = {

    //Networking
    httpPort: 3017,                     //RPC and interface binding port
    p2pPort: 6018,                      //P2P port (it is better to leave the same everywhere)
    sslMode: false,                     //Enable SSL mode
    httpServer: '0.0.0.0',            //Address of the RPC binding and interface
    rpcPassword: '',
    initialPeers: [                     //Starting nodes, for synchronization with the network
    ],
    allowMultipleConnectionsFromIp: true,//False - if there are a lot of loops in the network, True - if a proxy is used for the connection
    maxPeers: 25,                       //The recommended number is 15-20
    upnp: {                              //Automatic detection of network nodes
        enabled: true,                  //Enable automatic node detection on the network
        token: 'sollarpos'                //The token by which the node will search for other nodes (must be unique for each chain)
    },
    networkPassword: '',                //network access "password"
    enableAddressRotation: false,

    //Blockchain
    blockAcceptCount: 20,               //Number of transaction confirmation blocks
    hearbeatInterval: 20 * 1000,             //Internal node timer
    peerExchangeInterval: 5 * 1000,        //Refresh rate of peers
    maxBlockSend: 600,                  //Should be greater than blockQualityCheck
    blockQualityCheck: 100,             //The number of blocks "over" that we request to verify the validity of the chain
    limitedConfidenceBlockZone: 288,    //The zone of "trust". The chain cannot be changed earlier than this zone. There should be more blockQualityCheck
    generateEmptyBlockDelay: 5 * 60 * 1000,//5 minutes - With what frequency it is necessary to release empty blocks into the network when the network is idle
    blockHashFilter: {                  //Correct Block Filter for LCPoA
        blockEndls: [                   //4 characters at the end of the block. Genesis should get here
            'f3c8',
            'a000',
            '0000',
            '7027'
        ]
    },
    genesisTiemstamp: 1492004951 * 1000, //2017-07-23 01:00:00 Vitamin blockchain first started
    newNetwork: false,                   //If the launch of a new blockchain network is detected, an automatic issue of keys and money will be made
    lcpoaVariantTime: 1,                //The number of milliseconds required to generate a single block hash
    validators: [
        'pos',                     //"Validators" - additional validators of blocks, for the introduction of additional consensuses, except LCPoA
        // 'dlcpoa',
        //'lcpoa',                        //WITHOUT CONSENSUS WITHOUT KEYS, AUTOMATIC EMISSION IS IMPOSSIBLE
        //'thrusted'
    ],
    emptyBlockInterval: 10 * 1000,          //Interval for checking whether an empty block needs to be released
    blacklisting: false,
    maxTransactionAtempts: 5,           //How many attempts are we making to add a block
    keyringKeysCount: 5,                //How many keys to generate in a bunch at network start. Used in Trusted consensus and others
    checkExternalConnectionData: false, //Check external data for consistency
    transactionIndexEnable: true,

    //Messaging Bus
    enableMessaging: false,              //Allow the use of the message bus (required for some consensuses)
    recieverAddress: getid() + getid() + getid(), //The address of the node in the network.
    messagingMaxTTL: 3,                 //Maximum limit of message jumps
        //maximumInputSize: 15 * 1024 * 1024, //Maximum message size (here 15 megabytes)
    maximumInputSize: 2 * 1024 * 1024,
    allowMultipleSocketsOnBus: true, //permission to connect sockets with different addresses to the same bus address

    //Wallet
    walletFile: './runtime/wallet.json',         //Wallet file address
    workDir: './runtime',
    disableWalletDeploy: false,

    //Database
    blocksDB: 'blocks',                     // false - for storage in RAM, mega://bloks.json for storage in RAM and writing to ROM when unloading
    blocksSavingInterval: 5 * 60 * 1000,            // false = to disable autosave, or the number of milliseconds
    accountsDB: 'accounts',                 //Account manager database
    dbPath: '/contractsRuntime/EventsDB.db', // Database path if sqlite3
    dbConfig: {
        host: 'localhost',
        port: 5432,
        database: 'sol-pg-blockchain',
        user: 'postgres',
        password: 'saNszu4o',
        ssl: false,
        keepAlive: true,
    },

    //Application
    appEntry: false,       //Entry point to the "application". False - if not required
    startMessage: false,   //The message that is displayed when the node is started

    //SmartContracts
    ecmaContract: {
        enabled: true,                          //The contract processing system is enabled
        allowDebugMessages: true,              //Allows the output of messages to smart contracts
        contractInstanceCacheLifetime: 10 * 1000,   //Lifetime of the contract VM instance
        //ramLimit: 32,                         //Max RAM limit for contracts. Can be replaced by @deprecated
        masterContract: 1,                      //The main contract in the system. Implements the token functionality
        maxContractLength: 10 * 1024 * 1024,    // Max. size of the contract to be added
        defaultLimits: {
            ram: 1024 * 4,
            timeLimit: 2 * 60 * 1000,
            callLimit: 40 * 1000
        }
    },

    //Cryptography
    hashFunction: 'SHA256',                 //hash calculation function
    signFunction: 'bitcore',                 //Digital signature calculation and password generation function (empty means it is used by default), 'NEWSA'
    keyLength: 1024 * 2,                        //Key length for some algorithms
    generatorFunction: 'bitcore',            //Key generator function


    //Enabled plugins
    dbPlugins: [],                      //Database plugins list
    plugins: [                          //Crypto and other plugins
        "iz3-bitcore-crypto",
        "iz3-basic-crypto",
        "iz3-starwave-crypto",
        "sollar-block-fee",
        // "iz3-sqlite3-event-db",
        "iz3-pg-event-db",
        // "iz3-sequelize-event-db",
    ],
    appConfig: {                          //DApp config placement
        NN_CONTRACT_ADDRESS: false,
    },

    blockCacheLifeTime: 50,
};

//*********************************************************************
const fs = require('fs-extra');
const Blockchain = require('./Blockchain');
const path = require('path');
Array.prototype.remove = function (from, to) {
    let rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
};

global.PATH = {}; //object for saving paths
global.PATH.configDir = path.dirname(program.config);
let loadedConfig;

try {

    config = _.defaultsDeep(JSON.parse(fs.readFileSync(program.config)), config);


} catch (e) {
    logger.warning('No configure found. Using standard configuration.');
}


if(program.writeConfig) {
    try {
        fs.writeFileSync(program.writeConfig, JSON.stringify(config));
    } catch (e) {
        logger.warning('Can\'t save config');
    }
}

config.program = program;

if(config.program.splash) {
    require('./modules/splash')();
}


if(program.clear) {
    logger.info('Clear up.');
    fs.removeSync('wallets');
    fs.removeSync('blocks');
    fs.removeSync(config.walletFile);
    logger.info('End');
}

if(program.newChain) {
    config.newNetwork = true;
}

if(program.httpPort) {
    config.httpPort = program.httpPort;
}

if(program.disableRpcPassword) {
    config.rpcPassword = '';
}

if(program.blockAcceptCount) {
    config.blockAcceptCount = program.blockAcceptCount;
}

if(program.workDir) {
    config.workDir = program.workDir;
    config.walletFile = config.workDir + '/wallet.json';
}

if(program.clearDb) {
    fs.removeSync(config.workDir + '/wallets');
    fs.removeSync(config.workDir + '/blocks');
    logger.info('DB cleared');
}


if(program.generateWallets) {
    const Wallet = require('./modules/wallet');

    logger.info('Generating wallets from keyring ' + program.generateWallets);

    fs.ensureDirSync(config.workDir + '/keyringWallets');

    let keyring = JSON.parse(fs.readFileSync(program.generateWallets));
    for (let i in keyring) {
        if(keyring.hasOwnProperty(i)) {
            let wallet = new Wallet(config.workDir + '/keyringWallets/wallet' + i + '.json');
            wallet.enableLogging = false;
            wallet.keysPair = keyring[i];
            wallet.createId();
            wallet.update();
            wallet.save();
        }
    }

    logger.info('Wallets created');
    process.exit();
}

global.PATH.mainDir = __dirname;

if(global.PATH.configDir) {
    if(config.appEntry) {
        if(!fs.existsSync(config.appEntry)) {
            config.appEntry = global.PATH.configDir + path.sep + config.appEntry;
        } else {
            config.appEntry = (path.dirname(config.appEntry) + path.sep + path.basename(config.appEntry));
        }
        if(!fs.existsSync(config.appEntry)) {
            config.appEntry = global.PATH.mainDir + path.sep + config.appEntry;
        }

        config.appEntry = path.resolve(config.appEntry);
    }
}

if(!fs.existsSync(config.appEntry) && config.appEntry) {
    logger.fatalFall('App entry not found ' + config.appEntry);
}

if(config.startMessage) {
    console.log(config.startMessage);
}

if (!fs.existsSync(config.workDir)) {
    fs.mkdirSync(config.workDir);
}

const blockchain = new Blockchain(config);
blockchain.start();

if(!program.fallOnErrors) {
    process.on('uncaughtException', function (err) {
        logger.error('Uncaught exception: ' + err);
    });
}
