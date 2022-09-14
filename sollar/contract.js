/**
 *
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */
/**
 * Token emission amount
 * @type {number}
 */
const EMISSION = 1000 * 1000 * 1000;

/**
 * Token full name
 * @type {string}
 */
const TOKEN_NAME = 'SOL token';

/**
 * Token ticker
 * @type {string}
 */
const TICKER = 'SOL';

/**
 * Address of main contract owner
 * @type {string}
 */
const CONTRACT_OWNER = 'sol3SkCrMnxp7WzmJiCbzmJiCbjyJWbwwXHmyQt74C';
const CONTRACT_BACKEND = 'solFYZjVVbL4YbfC8FNmdjqEeRjmWNeQgKV6';

/**
 * C2C Fee transfer address
 * @type {string}
 */
const FEE_ADDRESS = 'sol6DT2Edd9NfKp4inD5ZBfDahDe6W7tcVsW';
// We transfer the issue for blocks to the validator
const BLOCK_EMISSION_ADDRESS = 'sol6DT2Edd9NfKp4inD5ZBfDahDe6W7tcVsW';
const MEDIA_ADDRESS = 'sol6DT2Edd9NfKp4inD5ZBfDahDe6W7tcVsW';

const TokenLogo = `
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="20" fill="#FF4239"/>
    <path d="M11.1111 23.714V28.8694C12.5333 28.8694 15.1406 29.1111 17.1555 27.8916C20.5333 25.8473 21.7394 22.178 23.6444 18.8253C25.8506 14.9426 27.9691 15.7906 28.8694 16.151L28.8889 16.1588V11.2701C28.2666 11.0923 26.3111 10.9145 24 11.6256C19.3778 13.0478 17.4326 20.0889 15.9111 21.9363C14.6666 23.4474 13.1555 24.6029 11.1111 23.714Z" fill="white"/>
</svg>
`;

/**
 * C2C Fee
 * @type {number}
 */
 const C2C_FEE = 0.001;

/**
 * Main token contract
 */
class SollarToken extends SollarMasterTokenContract {

    /**
     * Contract info
     * @return {{owner: string, ticker: string, name: string}}
     */
    get contract() {
        return {
            name: TOKEN_NAME,
            ticker: TICKER,
            owner: CONTRACT_OWNER,
            backend: CONTRACT_BACKEND,
            address: {
                fee: FEE_ADDRESS,
                block: BLOCK_EMISSION_ADDRESS,
                media: MEDIA_ADDRESS,
            },
            logo: TokenLogo,
            emission: EMISSION,
            contract: this._contract['wallet'],
            feeCoef: this._sollarSettings ? this._sollarSettings.feeCoef : undefined,
            c2cFee: C2C_FEE,
            type: 'token',
        };
    }

    /**
     * Initialization and emission
     */
    init() {
        super.init(EMISSION, true);

        this._rewards = new BlockchainMap('rewards');

        this._referrals = new BlockchainArray('Referrals');
        this._paysForRegisterOnSite = new BlockchainMap('paysForRegisterOnSite');

        // this._ClaimRewardEvent = new Event('ClaimRewardEvent', 'string', 'string', 'number');

        if (contracts.isDeploy()) {
            this._transferFromTo(this.contract.owner, this.contract.address.fee, 10000);
        }
    }

    payForRegisterOnSite(wallet, site_id, site_contract_wallet, site_contract_amount, amount, remain, sign) {
        amount = Number(amount);
        remain = Number(remain);
        site_contract_amount = Number(site_contract_amount);

        const signText = `${wallet}-${site_id}-${this.contract.backend}`;
        assert.true(global.crypto.verifySign(signText, sign, this.contract.backend), 'Invalid validate sign');

        const key = `${wallet}-${site_id}`;
        assert.false(this._paysForRegisterOnSite[key], 'Already payed');
        
        const pay = {
            amount,
        };

        this._paysForRegisterOnSite[key] = pay;

        const userAmount = amount;
        const withdrawAmount = site_contract_amount - amount;

        this._transferFromTo(site_contract_wallet, wallet, userAmount);

        if (withdrawAmount) {
            this._transferFromTo(site_contract_wallet, this.contract.address.fee, withdrawAmount);
        }
    }

    payForRefferal(referred, referral, sign) {
        const signText = `${referred}-${referral}-${this.contract.backend}`;
        assert.true(global.crypto.verifySign(signText, sign, this.contract.backend), 'Invalid validate sign');

        const referralData = this._referrals.find((_) => _.referred == referred && _.referral == referral);

        assert.false(referralData, 'Already payed');

        const data = {
            referral,
            referred,
            amount: this._sollarSettings['payForSoul'],
        };

        this._transferFromTo(this.contract.address.fee, data.referred, data.amount);
        this._referrals.push(data);
    }

    // TODO del
    // claimReward(wallet, claim_id, amount, sign) {
    //     if (typeof claim_id === 'number') {
    //         claim_id = String(claim_id);
    //     }

    //     const signText = `${wallet}-${claim_id}-${this.contract.backend}`;
        
    //     assert.true(global.crypto.verifySign(signText, sign, this.contract.backend), 'Invalid validate sign');

    //     const reward = this._rewards[claim_id] || {};

    //     assert.false(reward[wallet], 'Already claimed');

    //     const userReward = {
    //         wallet,
    //         amount
    //     };

    //     this._wallets.mint(wallet, new BigNumber(amount));
    //     this._ClaimRewardEvent.emit(claim_id, wallet, amount);

    //     reward[wallet] = userReward;

    //     this._rewards[claim_id] = reward;
    // }
}

global.registerContract(SollarToken);
