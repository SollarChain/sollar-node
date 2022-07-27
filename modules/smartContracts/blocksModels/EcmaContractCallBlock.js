/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */


const Signable = require('../../blocksModels/signable');
let type = 'ContractCallBlock';
const storj = require('../../instanceStorage');
const cryptography = storj.get('cryptography');

const stableStringify = require('json-stable-stringify');

/**
 * EcmaContract block
 */
class EcmaContractCallBlock extends Signable {

    /**
     * Get block type
     * @return {string}
     */
    static get blockType() {
        return type;
    }

    /**
     * Create EcmaContract calling block
     * @param {string} address
     * @param {string} method
     * @param {Object} args
     * @param {Object} state
     */
    constructor(address, method, args, state) {
        super();
        this.type = type;
        this.address = address;
        this.state = state;
        this.method = method;
        this.args = args;
        this.generateData();
    }

    /**
     * Data hash for sign
     */
    generateData() {
        this.data = cryptography.hash(this.type + this.address + stableStringify(this.state) + stableStringify(this.args) + this.method).toString();

    }


}

module.exports = EcmaContractCallBlock;
