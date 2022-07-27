/**
 Sollar blockchain - https://sollar.tech
    Copyright © 2017-2022 IZZZIO LLC
    Contacts: <info@izzz.io>
 */

const logger = new (require(global.PATH.mainDir + '/modules/logger'))("KeyPoA API");

/**
 * Модуль, добавляющий поддержку API вызовов для консенсуса KeyPoA
 */
module.exports = function register(blockchain, config, storj,) {
    logger.info('Initialize...');


    let app = storj.get('httpServer');

    /**
     * Check is key from storage
     */
    app.get('/keypoa/isKeyFromKeyStorage/:key', async function (req, res) {
        let keypoaInterface = storj.get('keypoa').interface;
        res.send({error: false, result: keypoaInterface.isKeyFromKeyStorage(req.params.key)});
    });

    app.post('/keypoa/isKeyFromKeyStorage', async function (req, res) {
        let keypoaInterface = storj.get('keypoa').interface;
        res.send({error: false, result: keypoaInterface.isKeyFromKeyStorage(req.body['key'])});
    });

    /**
     * Issue key
     * POST:
     * * key - Public key for issue
     * * type - Key type on of ['Admin','System']
     */
    app.post('/keypoa/issueKey', async function (req, res) {
        let keypoaInterface = storj.get('keypoa').interface;
        try {
            await keypoaInterface.issueKey(req.body['key'], req.body['type']);
            res.send({error: false});
        } catch (e) {
            res.send({error: true, message: e.message});
        }
    });

    /**
     * Delete key
     * POST:
     * * key - Public key for deleting
     */
    app.post('/keypoa/deleteKey', async function (req, res) {
        let keypoaInterface = storj.get('keypoa').interface;
        try {
            await keypoaInterface.deleteKey(req.body['key']);
            res.send({error: false});
        } catch (e) {
            res.send({error: true, message: e.message});
        }
    });


    logger.info('OK');
};