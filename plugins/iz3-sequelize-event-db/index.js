
const logger = new (require(global.PATH.mainDir + '/modules/logger'))("IZ3 Sequelize plugin");
const { Sequelize, QueryTypes } = require('sequelize');

let pluginStorj = null;


class SequelizeDatabase {
    db = null;
    path = '';

    constructor(path, cb) {
        this.config = pluginStorj.get('config');
        this.path = path;
        
        this.init(cb);
    }

    async init(cb) {
        const sequelize = new Sequelize('sqlite::memory:', { logging: false });

        try {
            await sequelize.authenticate();
            logger.info('Connection has been established successfully.');
        } catch (error) {
            logger.info('Unable to connect to the database:', error);
        }

        this.db = sequelize;

        this.attachDataBase(() => {
            this.createTable(cb);
        })
    }

    async row(sql, cb) {
        try {
            const [rows, metadata] = await this.db.query(sql);
            cb(null, rows);
        } catch (e) {
            cb(e);
        }
    }

    async attachDataBase(cb) {
        this.row(`
            DROP TABLE IF EXISTS "events";
        `, (err) => {
            cb();
        })
    }

    async createTable(cb) {
        this.row(`
            CREATE TABLE IF NOT EXISTS "events" (
                "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                "event" TEXT NOT NULL,
                "contract" INTEGER NOT NULL,
                "timestamp" TEXT,
                "block" INTEGER,
                "hash" TEXT,
                "v1" TEXT,
                "v2" TEXT,
                "v3" TEXT,
                "v4" TEXT,
                "v5" TEXT,
                "v6" TEXT,
                "v7" TEXT,
                "v8" TEXT,
                "v9" TEXT,
                "v10" TEXT
            );
        `, (err) => {
            cb(err);
        })
    }

    exec(sql, cb) {
        return this.row(sql, cb);
    }

    run(sql, cb) {
        return this.row(sql, cb);
    }

    all(sql, cb) {
        return this.row(sql, cb);
    }

    flush(cb) {
        cb();
    }
}


module.exports = function register(blockchain, config, storj) {
    logger.info('Initialize Database');
    
    pluginStorj = storj;
    storj.put('DefaultDB', SequelizeDatabase);
    
    logger.info('OK');
};
