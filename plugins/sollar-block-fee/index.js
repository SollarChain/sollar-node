const logger = new (require(global.PATH.mainDir + '/modules/logger'))("Block Fee");


module.exports = function(_blockchain, config, storj) {
    logger.info('Initialize...');

    storj.put('useFeeFromBlock', true);

    logger.info('OK');
}