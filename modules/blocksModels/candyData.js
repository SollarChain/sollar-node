/**
 Candy - https://github.com/Izzzio/Candy

 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */


const Signable = require('./signable');
const storj = require('../instanceStorage');
const cryptography = storj.get('cryptography');
let type = 'CandyData';

/**
 * Candy data block
 * Candy - part of Izzzio blockchain. https://github.com/Izzzio/Candy
 * @type {Signable}
 */
class CandyData extends Signable {
    /**
     *
     * @param {String} data
     */
    constructor(data) {
        super();
        this.type = type;
        this.candyData = data;
        this.generateData();
    }

    /**
     * Creates a data string for the signature
     */
    generateData() {
        this.data = this.type + cryptography.hash(this.candyData);
    }


}

module.exports = CandyData;
