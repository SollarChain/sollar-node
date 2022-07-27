/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */

/**
 * Signable object
 * Many objects require a sign
 */
class Signable {
    constructor() {
        this.data = '';
        this.sign = '';
        this.pubkey = '';
        this.type = 'Empty';
    }

    isSigned() {
        return this.sign.length !== 0;
    }
}

module.exports = Signable;
