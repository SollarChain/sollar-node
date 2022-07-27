/**
 * Site connect contract
 * */

const CONTRACT_OWNER = '{{contract_owner}}';

class SiteContract extends Contract {
	init() {
		super.init();

		this.domain = new BlockchainMap('domain');
		this.users = new BlockchainMap('users');
		
		this.usersSettings = new BlockchainMap('users');

		if (contracts.isDeploy()) {
			this.domain['master'] = '{{contract_domain}}';
			this.usersSettings['count'] = 0;
		}
	}

    get contract() {
        return {
            owner: CONTRACT_OWNER,
			domain: this.domain['master'],
			usersCount: this.usersSettings['count'],
            type: 'contract',
        };
    }

	setDomain(newDomain, sign) {
		// const signText = newDomain;
		// assert.assert(global.crypto.verifySign(signText, sign, this.contract.owner), 'Invalid sign');

		this.domain['master'] = newDomain;
	}

	siteAuthorization(wallet, sign) {
		// const signText = wallet;
		// assert.assert(global.crypto.verifySign(signText, sign, wallet), 'Invalid sign');

		if (this.users[wallet]) {
			return true;
		}

		const user = {
			authorization: true,
		};

		this.users[wallet] = user;
		this.usersSettings['count'] += 1;

		return true;
	}

	checkIsUsersAuthorized(wallets) {
		const authorizedWallets = [];

		for (const wallet of wallets) {
			if (this.users[wallet] && this.users[wallet].authorization) {
				authorizedWallets.push(wallet);
			}
		}

		return JSON.stringify(authorizedWallets);
	}
}

global.registerContract(SiteContract);