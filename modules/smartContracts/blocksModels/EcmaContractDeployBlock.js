/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */


const Signable = require('../../blocksModels/signable');
let type = 'ContractDeploy';
const storj = require('../../instanceStorage');
const cryptography = storj.get('cryptography');

const stableStringify = require('json-stable-stringify');

/**
 * EcmaContract block
 */
class EcmaContractDeployBlock extends Signable {

    /**
     * Get block type
     * @return {string}
     */
    static get blockType() {
        return type;
    }

    /**
     * Create EcmaContract block
     * @param {string} ecmaCode
     * @param {Object} state
     */
    constructor(ecmaCode, state) {
        super();
        this.type = type;
        this.ecmaCode = ecmaCode;
        this.state = state;
        this.state.codeHash = cryptography.hash(this.ecmaCode).toString();
        this.generateData();
        this.generateWallet();
    }

    /**
     * Data hash for sign
     */
    generateData() {
        this.data = cryptography.hash(this.type + this.ecmaCode + stableStringify(this.state)).toString();
    }

    generateWallet() {
        const wallet = storj.get('generateWallet')();
        this.wallet = wallet.public;
    }

}

module.exports = EcmaContractDeployBlock;
