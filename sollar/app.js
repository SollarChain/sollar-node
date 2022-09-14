
const logger = new (require(global.PATH.mainDir + "/modules/logger"))("Main Contract");

const assert = require(global.PATH.mainDir + "/modules/testing/assert");
const storj = require(global.PATH.mainDir + "/modules/instanceStorage");
const DApp = require(global.PATH.mainDir + "/app/DApp");

const fs = require('fs-extra');
const MainContract = fs.readFileSync(`${global.PATH.mainDir}/sollar/contract.js`).toString();
const SecondContract = fs.readFileSync(`${global.PATH.mainDir}/sollar/contract2.js`).toString();
const SiteRegisterTemplate = fs.readFileSync(`${global.PATH.mainDir}/sollar/templates/SiteContract.js`).toString();

const TokenContractConnector = require(global.PATH.mainDir + '/modules/smartContracts/connectors/TokenContractConnector');


class App extends DApp {
    contractIds = [];

    get BlockchainPublicKey() {
        return this.blockchain.wallet.keysPair.public;
    }

    async callMethodRollback(contractAddress, method, args = [], state = {}, ...other) {
        return this.contracts.ecmaPromise.callMethodRollback(contractAddress, method, args, state, ...other);
    }

    async deployMethod(contractAddress, method, args = [], state = {}, ...other) {
        return this.contracts.ecmaPromise.deployMethod(contractAddress, method, args, state, ...other);
    }

    async contractExists(contractAddress) {
        return this.contracts.ecmaPromise.contractExists(contractAddress);
    }

    async deployContract(contractCodeOrBlock, contractOwner, resourceRent=0, cb, ...other) {
        return this.contracts.ecmaPromise.deployContract(contractCodeOrBlock, resourceRent, cb, contractOwner, ...other);
    }

    // async setNodeIsOnline() {
    //     try {
    //         const masterContract = this.getMasterContractAddress() || 1;
    //         if (await this.contractExists(masterContract)) {
    //             const isNodeInValidatorsList = await this.callMethodRollback(masterContract, 'checkIsNodeInValidators', [this.BlockchainPublicKey]);
    //             if (!isNodeInValidatorsList) {
    //                 console.log('Node not in validators list');
    //                 return;
    //             }
    //             const nodeIsOnline = await this.callMethodRollback(masterContract, 'checkNodeIsOnline', [this.BlockchainPublicKey]);
    //             if (!nodeIsOnline) {
    //                 return this.deployMethod(masterContract, 'setNodeIsOnline', [this.BlockchainPublicKey]);
    //             }
    //         }
    //     } catch (e) {
    //         console.log('Error when set node status to online', e);
    //     }
    // }

    // async setNodeIsOffline(address) {
    //     const masterContract = this.getMasterContractAddress() || 1;
    //     return this.deployMethod(masterContract, 'setNodeIsOffline', [address]);
    // }

    // async checkIsEmptyValidators() {
    //     const masterContractAddress = this.getMasterContractAddress() || 1;
    //     const nodeForValidating = await this.callMethodRollback(masterContractAddress, 'getNodeForValidating');
    //     if (!nodeForValidating) {
    //         await this.deployMethod(masterContractAddress, 'resetNodes');
    //         return true;
    //     }
    //     return false;
    // }

    handlers = {};

    pingNodeByMessage(message, cb) {
        const key = `${message.sender}-${message.reciver}-${new Date().getTime()}`;
        const reciever = message.reciver;

        this.handlers[key] = {cb, isPong: false};
        const newMessage = this.messaging.starwave.createMessage(key, reciever, undefined, `ping`);
        this.messaging.starwave.sendMessage(newMessage);

        setTimeout(() => {
            const handler = this.handlers[key];
            if (handler) {
                if (!handler.isPong) {
                    handler.cb(false);
                }
            }
        }, 5000)
    }

    async validateOrSendToRandomNode(message) {
        console.log('Сообщение от', message.sender, 'тип:', message.id, 'данные:', message.data);
        const contractAddress = message.contractAddress;
        // const masterContractAddress = this.getMasterContractAddress() || 1;

        return this.deployMethod(contractAddress, message.id, message.data, {sender: message.sender});

        // const isNodeInValidatorsList = await this.callMethodRollback(masterContractAddress, 'checkIsNodeInValidators', [this.BlockchainPublicKey]);
        // if (!isNodeInValidatorsList) {
        //     // const randomNode = await this.callMethodRollback(masterContractAddress, 'getNodeInValidatorsList', [this.BlockchainPublicKey]);
        //     // if (randomNode) {
        //     //     const nodeData = JSON.parse(randomNode);
        //     //     message['reciver'] = nodeData.address;
        //     //     this.messaging.starwave.sendMessage(message);
        //     // }
        //     return;
        // }

        // const isNodeCanValidate = await this.callMethodRollback(masterContractAddress, 'checkIsNodeCanValidate', [this.BlockchainPublicKey]);
        // if (isNodeCanValidate) {
        //     await this.deployMethod(contractAddress, message.id, message.data, {sender: message.sender});
        //     await this.checkIsEmptyValidators();
        // } else {
        //     const nodeForValidating = await this.callMethodRollback(masterContractAddress, 'getNodeForValidating');
        //     if (!nodeForValidating) {
        //         await this.deployMethod(masterContractAddress, 'resetNodes');
        //         return setImmediate(() => this.validateOrSendToRandomNode(message));
        //     }

        //     const nodeData = JSON.parse(nodeForValidating);
        //     if (nodeData.address === this.BlockchainPublicKey) {
        //         return setImmediate(() => this.validateOrSendToRandomNode(message));
        //     }

        //     const newNodeAddress = nodeData.address;
        //     const newMessage = this.messaging.starwave.createMessage(message.data, newNodeAddress, message.sender, message.id);

        //     if (message.contractAddress) {
        //         newMessage.contractAddress = message.contractAddress;
        //     }

        //     this.pingNodeByMessage(newMessage, async (isPong, isNodeCanValidate) => {
        //         if (isPong) {
        //             if (isNodeCanValidate) {
        //                 console.log('Не могу задеплоить сообщение, переадресовываю', newNodeAddress);
        //                 this.messaging.starwave.sendMessage(newMessage);
        //             } else {
        //                 console.log('Выбранная нода не может сейчас завалидировать');
        //                 setImmediate(() => this.validateOrSendToRandomNode(newMessage));
        //             }
        //         } else {
        //             console.log('Нода не отвечает', newMessage.reciver);
        //             await this.setNodeIsOffline(newMessage.reciver);
        //             await this.checkIsEmptyValidators();
        //             setImmediate(() => this.validateOrSendToRandomNode(newMessage));
        //         }
        //     })
        // }
    }

    async loadContractsIds() {
        try {
            const masterContractAddress = this.getMasterContractAddress() || 1;
            if (await this.contractExists(masterContractAddress)) {
                const contractIdsStr = await this.callMethodRollback(masterContractAddress, 'getContractsAddress');
                const contractsIds = JSON.parse(contractIdsStr);

                const ids = [masterContractAddress].concat(contractsIds.map(_ => Number(_)));

                this.contractIds = ids;
            }
        } catch (e) {
            console.error('Error | loadContractsIds', e);
        }
    }

    async init() {
        logger.info('DApp started');

        this.contractAddress = this.getAppConfig()?.NN_CONTRACT_ADDRESS;

        this.contractIds = [this.getMasterContractAddress() || 1];

        if (this.contractAddress) {
            if (!await this.contractExists(this.contractAddress)) {
                logger.error('No deployed contract found! Deploying...');

                const newBlock = await this.deployContract(MainContract);
                this.contractAddress = newBlock.block.index;
                logger.info('Contract deployed at ' + this.contractAddress);

                const contract = new TokenContractConnector(this.ecmaContract, this.contractAddress);
                const contractInfo = await contract.contract;
                console.log('contractInfo.owner', contractInfo.owner);
                
                const secondNewContract = await this.deployContract(SecondContract, contractInfo.owner);
                logger.info(`Second contract deployed at ${secondNewContract.block.index}`);
            }
        } else {
            logger.warning('Contract disabled');
        }

        await this.loadContractsIds();
        // setInterval(async () => await this.setNodeIsOnline(), 5 * 1000);

        this.messaging.starwave.registerMessageHandler('ping', async (message) => {
            const masterContractAddress = this.getMasterContractAddress() || 1;
            const isNodeCanValidate = await this.callMethodRollback(masterContractAddress, 'checkIsNodeCanValidate', [this.BlockchainPublicKey]);
            const newMessage = this.messaging.starwave.createMessage({key: message.data, isNodeCanValidate}, message.sender, undefined, `pong`);
            this.messaging.starwave.sendMessage(newMessage);
        });

        this.messaging.starwave.registerMessageHandler('pong', async (message) => {
            const handler = this.handlers[message.data?.key];
            if (handler) {
                handler.cb(true, message.data?.isNodeCanValidate);
                handler.isPong = true;
            }
        });

        /**/

        // this.network.rpc.registerPostHandler('/node/add/', async (req, res) => {
        //     const masterContractAddress = this.getMasterContractAddress() || 1;
        //     const ownerWallet = req.body.wallet;
        //     const recieverAddress = req.body.recieverAddress || this.getConfig().recieverAddress;
        //     const sender = ownerWallet;

        //     const data = await this.deployMethod(masterContractAddress, 'addNodeToWhiteList', [ownerWallet, recieverAddress], { sender });

        //     res.json({ data });
        // });

        this.messaging.starwave.registerMessageHandler('addNodeToWhiteList', async (message) => {
            return setImmediate(() => this.validateOrSendToRandomNode(message));
        });

        /**
         * Sites
         * */

         this.network.rpc.registerPostHandler('/site/register', async (req, res) => {
            const contractOwner = req.body.owner;
            const contractDomain = req.body.domain;
            const siteTemplate = SiteRegisterTemplate.replace('{{contract_owner}}', contractOwner).replace('{{contract_domain}}', contractDomain);

            try {
                const newBlock = await this.deployContract(siteTemplate, contractOwner);
                res.json({ newBlock });
            } catch (e) {
                res.json(this.jsonErrorResponse(e));
            }
        });

        this.network.rpc.registerPostHandler('/fee/calculate', async (req, res) => {
            const {method, args} = req.body;

            const fee = await this.contracts.ecmaContract.deployContractMethodCalculateFee(method, args);
            res.json({ result: Number(fee.toFixed(8)) });
        });

        /**
         * Site auth
         */
         this.network.rpc.registerPostHandler('/site/auth/:contractAddress', async (req, res) => {
            const contractAddress = String(req.params.contractAddress);
            const {wallet, sign} = req.body;

            const data = await this.deployMethod(contractAddress, 'siteAuthorization', [wallet, sign]);

            res.json({ data });
        });

        this.network.rpc.registerPostHandler('/site/check/:contractAddress', async (req, res) => {
            const contractAddress = String(req.params.contractAddress);
            const {wallets} = req.body;

            const data = await this.callMethodRollback(contractAddress, 'checkIsUsersAuthorized', [wallets]);

            res.json({ data: JSON.parse(data) });
        });

        /**
         * Pay for register
         */
         this.network.rpc.registerPostHandler('/pay/site/register', async (req, res) => {
            const masterContractAddress = this.getMasterContractAddress() || 1;
            const {wallet, site_id, site_contract_wallet, site_contract_amount, amount, remain, sign} = req.body;
            const sender = req.body.sender;

            const data = await this.deployMethod(masterContractAddress, 'payForRegisterOnSite', [wallet, site_id, site_contract_wallet, site_contract_amount, amount, remain, sign], { sender });

            res.json({ data });
        });

        /**
         * Pay for Referral
         */
         this.network.rpc.registerPostHandler('/pay/referral', async (req, res) => {
            const masterContractAddress = this.getMasterContractAddress() || 1;
            const {referred, referral, sign} = req.body;
            // const sender = req.body.sender;
            const instance = await this.contracts.ecmaContract.getContractInstanceByAddressAsync(masterContractAddress);
            const sender = instance.info.address.fee

            const data = await this.deployMethod(masterContractAddress, 'payForRefferal', [referred, referral, sign], { sender });
            res.json({ data });
        });

        /**
         * Contracts info
         * */
        this.network.rpc.registerPostHandler('/contracts/info', async (req, res) => {
            await this.loadContractsIds();

            const contractsInfo = await Promise.all(
                this.contractIds.map(async address => {
                    const instance = await this.contracts.ecmaContract.getContractInstanceByAddressAsync(address);
                    const info = instance.info;

                    const obj = {
                        address,
                        ticker: info.ticker,
                    };

                    return obj;
                }))

            res.json({ data: contractsInfo });
        });

        /**
         * Get free coins
         **/

        this.messaging.starwave.registerMessageHandler('getFreeCoins', async (message) => {
            return setImmediate(() => this.validateOrSendToRandomNode(message));
        });

        /**
         * Transactions
         **/

        this.messaging.starwave.registerMessageHandler('transferFromTo', async (message) => {
            return setImmediate(() => this.validateOrSendToRandomNode(message));
        });


        const registerTransfersEvent = (contractAddress, eventType, data, cb) => {
            cb();

            if (Date.now() - Number(data[5]) > 10000) {
                return;
            }

            const body = data;
            // console.log('body', data[1], '-', data[2], data[3], '|', data[5]);
            // data[5] = new Date().getTime();

            const sendTo = [data[1], data[2]];

            for (const reciever of sendTo) {
                if (reciever != this.BlockchainPublicKey) {
                    let message = this.messaging.starwave.createMessage(body, reciever, undefined, `transfers`);
                    message.contractAddress = contractAddress;
                    this.messaging.starwave.sendMessage(message);
                }
            }
        }

        for (const contractAddress of this.contractIds) {
            this.ecmaContract.events.registerEventHandler(contractAddress, 'Transfer', registerTransfersEvent);
            this.ecmaContract.events.registerEventHandler(contractAddress, 'TransferFeeEvent', registerTransfersEvent);
            this.ecmaContract.events.registerEventHandler(contractAddress, 'ContractFeeEvent', registerTransfersEvent);
        }

        /**
         * Balance
         **/

        this.network.rpc.registerPostHandler('/balance/:contractAddress', async (req, res) => {
            const contractAddress = String(req.params.contractAddress);
            const wallet = req.body.wallet;

            const data = await this.callMethodRollback(contractAddress, 'balanceOf', [wallet]);

            res.json({ data });
        });



        /**
         * Transaction history
         **/

         this.network.rpc.registerPostHandler('/transfer-history/:contractAddress', async (req, res) => {
            const contractAddress = req.params.contractAddress;
            const wallet = req.body.wallet;
            const limit = req.body.limit || 10;
            const offset = req.body.offset || 0;

            let sql = null;

            if (contractAddress === 'all') {
                sql = `
                    SELECT *
                    FROM "events"
                    WHERE "event" IN('Transfer', 'TransferFeeEvent', 'ContractFeeEvent')
                    AND ("v2"='${wallet}' OR "v3"='${wallet}')
                    ORDER BY block DESC
                    LIMIT ${limit}
                    OFFSET ${offset}
                `;
            } else {
                sql = `
                    SELECT *
                    FROM "events"
                    WHERE "event" IN('Transfer', 'TransferFeeEvent', 'ContractFeeEvent')
                    AND "contract"='${contractAddress}'
                    AND ("v2"='${wallet}' OR "v3"='${wallet}')
                    ORDER BY block DESC
                    LIMIT ${limit}
                    OFFSET ${offset}
                `;
            }

            this.ecmaContract.events.rawQuery(sql, async (err, values) => {
                res.json({ data: values });
            })
        });

        this.network.rpc.registerPostHandler('/events/list', async (req, res) => {
            const minBlockIndex = req.body.minBlockIndex;
            const maxBlockIndex = req.body.maxBlockIndex;

            const sql = `
                SELECT * 
                FROM "events"
                WHERE "block" >= '${minBlockIndex}' 
                AND "block" <= ${maxBlockIndex}
                ORDER BY block DESC
            `;

            this.ecmaContract.events.rawQuery(sql, async (err, values) => {
                res.json({ data: values });
            })
        });


        /**
         * Search
         * */

        this.network.rpc.registerPostHandler('/ertc/search/validation/:data', async (req, res) => {
            const find_text = req.params.data;

            const offset = isFinite(req.body?.offset) ? req.body.offset : 0;
            const limit = isFinite(req.body?.limit) ? req.body.limit : 10;
            const contractAddress = req.body.contractAddress;

            const _contractAddress = isFinite(contractAddress) ? `"contract"='${contractAddress}' AND` : '';
            const _hash = `"hash"='${find_text}'`
            const _block = isFinite(find_text) ? `OR "block"=${find_text}` : '';
            const _v1 = `OR "v1" LIKE '%${find_text}%'`;
            const _v2 = `OR "v2" LIKE '%${find_text}%'`;
            const _v3 = `OR "v3" LIKE '%${find_text}%'`;
            const _v4 = `OR "v4" LIKE '%${find_text}%'`;

            const _limit = `LIMIT ${limit}`;
            const _offset = `OFFSET ${offset}`;

            const rawQuery = `SELECT * FROM "events" WHERE ${_contractAddress} (${_hash} ${_block} ${_v1} ${_v2} ${_v3} ${_v4}) ORDER BY block DESC ${_limit} ${_offset}`;
            const rawQueryCount = `SELECT count(*) as count FROM "events" WHERE ${_contractAddress} (${_hash} ${_block} ${_v1} ${_v2} ${_v3} ${_v4}) ORDER BY block DESC`;
            this.ecmaContract.events.rawQuery(rawQuery, async (err, values) => {
                this.ecmaContract.events.rawQuery(rawQueryCount, async (err2, valuesCount) => {
                    const count = valuesCount[0].count;
                    const mappedList = new Set();

                    values.forEach(value => {
                        const data = this.jsonFormatResultFromDB(value);
                        if (data) {
                            mappedList.add(data);
                        }
                    });

                    const list = [...mappedList];

                    res.send(this.jsonOkResponse({ list, count }));
                });
            });
        });

        this.network.rpc.registerPostHandler('/ertc/search/wallet/:data', async (req, res) => {
            const find_text = req.params.data;

            const offset = isFinite(req.body?.offset) ? req.body.offset : 0;
            const limit = isFinite(req.body?.limit) ? req.body.limit : 10;
            const contractAddress = req.body.contractAddress;

            const _contractAddress = isFinite(contractAddress) ? `"contract"='${contractAddress}' AND` : '';
            const _in = `IN('TransferCurrency', 'TransferSquares', 'Emission', 'Burn')`;
            const _v1 = `AND "v1"='${find_text}'`;
            const _v2 = `OR "v2"='${find_text}'`;
            const _v3 = `OR "v3"='${find_text}'`;
            const _v4 = `OR "v4" LIKE '%${find_text}%'`;

            const _limit = `LIMIT ${limit}`;
            const _offset = `OFFSET ${offset}`;

            const rawQuery = `SELECT * FROM "events" WHERE ${_contractAddress} ("event" ${_in} ${_v1} ${_v2} ${_v3} ${_v4}) ORDER BY block DESC ${_limit} ${_offset}`;
            const rawQueryCount = `SELECT count(*) as count FROM "events" WHERE ${_contractAddress} ("event" ${_in} ${_v1} ${_v2} ${_v3} ${_v4}) ORDER BY block DESC`;
            this.ecmaContract.events.rawQuery(rawQuery, async (err, values) => {
                this.ecmaContract.events.rawQuery(rawQueryCount, async (err2, valuesCount) => {
                    const count = valuesCount[0].count;
                    const mappedList = new Set();

                    values.forEach(value => {
                        const data = this.jsonFormatResultFromDB(value);
                        if (data) {
                            mappedList.add(data);
                        }
                    });

                    const list = [...mappedList].filter(_ => _);

                    res.send(this.jsonOkResponse({ list, count }));
                });
            });
        });
    }

    //

    jsonFormatResultFromDB(value) {
        let result = {};
        switch (value.event) {
            case 'Transfer':
                result = {
                    block: value.block,
                    contract: value.contract,
                    blockHash: value.hash,
                    event: value.event,
                    date: Number(value.timestamp),
                    currency: value.v1,
                    from: value.v2,
                    to: value.v3,
                    amount: value.v4,
                    fee: value.v5,
                };
            break;

            case 'TransferFeeEvent':
            case 'ContractFeeEvent':
                result = {
                    block: value.block,
                    contract: value.contract,
                    blockHash: value.hash,
                    event: value.event,
                    date: Number(value.timestamp),
                    from: value.v1,
                    to: value.v2,
                    amount: value.v3,
                };
            break;

            case 'Mint':
                result = {
                    block: value.block,
                    contract: value.contract,
                    blockHash: value.hash,
                    event: value.event,
                    date: Number(value.timestamp),
                    to: value.v1,
                    amount: value.v2,
                }
            break;
            default:
                return false;
        }

        return result;
    }

    /**
     * Responses
     * */

    /**
     * Error response
     * @param error
     * @return {{errorMessage: *, error: boolean}}
     */
    jsonErrorResponse(error) {
        if(typeof error === 'string') {
            return {error: true, errorMessage: error};
        }
        return {error: true, errorMessage: error.message, e: error};
    }

    /**
     * Reponse ok
     * @param data
     * @return {{data: *, error: boolean}}
     */
    jsonOkResponse(data) {
        return {error: false, data: data}
    }
}

module.exports = App;
