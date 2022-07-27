/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */

/**
 * Simplify interactions with contracts
 */
class ContractConnector {
    /**
     *Simplify interactions with contracts
     * @param {EcmaContract} ecmaContract
     * @param address
     */
    constructor(address) {
        this.contracts = global.contracts;
        this.address = address;
    }

    /**
     * Register new stateless method
     * @param method
     * @param alias
     */
    registerMethod(method, alias) {
        let that = this;
        alias = (typeof alias === 'undefined' ? method : alias);
        this[alias] = (...args) => {
            return that.contracts.callMethodRollback(that.address, method, args);
        }
    }

    /**
     * Register new deploying method. This call creates transaction
     * @param method
     * @param alias
     */
    registerDeployMethod(method, alias) {
        let that = this;
        alias = (typeof alias === 'undefined' ? method : alias);
        this[alias] = (...args) => {
            return that.contracts.callMethodDeploy(that.address, method, args);
        }
    }

    /**
     * Returns property value
     * @param property
     * @return {*}
     */
    getProperty(property){
        return this.contracts.getContractProperty(this.address, property);
    }
}
