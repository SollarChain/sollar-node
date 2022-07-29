

// var wallet = iz3BitcoreCrypto.generateWallet();
// var sign = iz3BitcoreCrypto.sign('qwe', wallet.keysPair.private);
// var isSignValidate = iz3BitcoreCrypto.validate('qwe', sign, wallet.keysPair.public);
// console.log(wallet);
// console.log(sign);
// console.log(isSignValidate);

class API {
	api_path = location.origin;
	nodes = [];
	nodeRecieverAddress = '';

	headers = {
		"content-type": "application/json",
	}
	master_contract_address = 1;
	
	master_ticker = 'SOL';

	constructor() {
		this.setPath('https://node1.testnet.sollar.tech');
		this.nodes = ['wss://wss.testnet.sollar.tech/'];
		this.nodeRecieverAddress = '';

		this.setPath(API_PREFIX);
		this.nodes = nodes;
	}

	setPath(path) {
		this.api_path = path;
		$('#network-url').text(path);
	}

	request(path, data, contractAddress=this.master_contract_address, method='post') {
		return new Promise((resolve, reject) => {
			let url = `${this.api_path}${path}`;

			if (url.endsWith('/')) {
				url += contractAddress;
			} else {
				url += `/${contractAddress}`;
			}

			fetch(url, {
				method,
				headers: this.headers,
				body: JSON.stringify(data),
			})
			.then(res => {
				resolve(res.json())
			})
			.catch(reject);
		})
	}

	getRequest(path, query) {
		return new Promise((resolve, reject) => {
			const url = `${this.api_path}${path}`;

			fetch(url, {
				method: 'get', 
				headers: this.headers,
				query: query
			})
			.then(res => {
				resolve(res.json())
			})
			.catch(reject);
		})
	}

	postRequest(path, body) {
		return new Promise((resolve, reject) => {
			const url = `${this.api_path}${path}`;

			fetch(url, {
				method: 'post', 
				headers: this.headers,
				body: JSON.stringify(body)
			})
			.then(res => {
				resolve(res.json())
			})
			.catch(reject);
		})
	}

	async getRecieverAddressMasterNode() {
		const url = 'https://explorer.testnet.sollar.tech/recieverAddress';

		return new Promise((reolsve, reject) => {
			fetch(url, {
				method: 'GET',
				headers: this.headers,
			})
			.then(res => {
				reolsve(res.json())
			})
			.catch(reject)
		})
	}

	async updateRecieverAddressMasterNode() {
		const {recieverAddress} = await this.getRecieverAddressMasterNode();

		this.nodeRecieverAddress = recieverAddress;
	}
}


class Wallet extends API {
	data = {};
	storageName = 'wallet';
	goodWallet = false;
	balance = 0;
	node = {};

	constructor() {
		super();

		this.init();
	}

	save() {
		localStorage.setItem(this.storageName, JSON.stringify(this.data));
	}

	init() {
		let wallet;
		try {
			wallet = JSON.parse(localStorage.getItem(this.storageName));
			if (wallet.public) {
				this.goodWallet = true;
			}
		} catch (e) {
			wallet = {};
			this.goodWallet = false;
		}

		this.data = wallet;
		this.save();
	}

	create() {
		let wallet = iz3BitcoreCrypto.generateWallet();

		this.goodWallet = true;
		this.data = wallet.keysPair;
		this.generateWalletFile();
		this.save();
	}

	get public() {
		return this.data.public;
	}

	get private() {
		return this.data.private;
	}

	async loadBalance() {
		const {data} = await this.request(`/balance/`, {wallet: this.data.public});
		this.balance = data;
		$('.balance').text(`${this.balance} ${this.master_ticker}`);
	}

	generateWalletFile() {
		const fileName = this.public.slice(0, 6) + '_' + this.public.slice(this.public.length - 6)
		const data = JSON.stringify({ public: this.public, private: this.private });
		const a = document.createElement('a');
		const file = new Blob([data], {type: 'application/json'});
		a.href = URL.createObjectURL(file);
		a.download = fileName + '.json';
		a.click();
		a.remove();
	}

	checkAuth(account) {
		const sign = iz3BitcoreCrypto.sign('auth', account.private);
		const verify = iz3BitcoreCrypto.validate('auth', sign, account.public);
		return verify;
	}

	setWallet(account) {
		if (this.checkAuth(account)) {
			this.data = account;
			this.goodWallet = true;
			return true;
		}

		return false;
	}


	async loadNodeInfo() {
		const nodeInfo = await this.getRequest(`/node/getInfo/`);
		console.log('nodeInfo', nodeInfo);
		this.node = nodeInfo;

		$('.node-status').text(nodeInfo.nodeInValidators ? 'Yes' : 'No');
		$('.node-wallet').text(nodeInfo.publicAddress);

		if (nodeInfo.nodeInValidators) {
			$('#node-startValidating').removeClass('btn-success');
			$('#node-startValidating').addClass('btn-secondary');
			$('#node-startValidating').css('display', 'none');

			$('.node-status').removeClass('text-danger');
			$('.node-status').addClass('text-success');
		} else {
			$('#node-startValidating').css('display', 'block');
			$('#node-startValidating').addClass('btn-success');
			$('#node-startValidating').removeClass('btn-secondary');

			$('.node-status').addClass('text-danger');
			$('.node-status').removeClass('text-success');
		}
	}

	async startNodeToValidate() {
		const body = [this.data.public, this.node.publicAddress, this.node.recieverAddress];

		const message = candy.starwave.createMessage(
			body, 
			this.nodeRecieverAddress,
			undefined,
		'addNodeToWhiteList')
		message['contractAddress'] = this.master_contract_address;
		candy.starwave.sendMessage(message);

		setTimeout(() => this.loadNodeInfo(), 5000);
	}
}

const wallet = new Wallet();
let candy;

$(async function() {
	await initAll();
});

async function initAll() {
	await initCreateWallet();
	await checkExistWallet();
}

async function initCreateWallet() {
	$('#wallet-create').css('display', 'block');
	$('#wallet-create button').on('click', async e => {
		wallet.create();

		location.reload();
		// await checkExistWallet();
	});

	$('#wallet-auth').css('display', 'block');
	$('#wallet-auth #authfile').on('change', async e => {
		const files = e.target.files;
		const file = files[0];
		const reader = new FileReader();
		reader.onload = async (event) => {
			const file = event.target.result;
			const account = JSON.parse(file);
			const decodePassword = prompt('Decode password');
			console.log('')
			console.log('account.private', account.private, decodePassword);
			account.private = CryptoJS.AES.decrypt(account.private, decodePassword).toString(CryptoJS.enc.Utf8);;
			console.log('account.private', account.private);


			if (wallet.setWallet(account)) {
				await checkExistWallet();
			}
		}
		reader.readAsText(file);
	});
	$('#wallet-auth #createWallet').on('click', async e => {
		wallet.create();

		location.reload();
	});
}

function copyToClipboard(element) {
    var $temp = $("<input>");
    $("body").append($temp);
    $temp.val($(element).val()).select();
    document.execCommand("copy");
    $temp.remove();
}

async function checkExistWallet() {
	if (wallet.goodWallet) {
		$('#wallet-create').css('display', 'none');
		$('#wallet-auth').css('display', 'none');
		$('#my-wallet').css('display', 'block');
		$('#transactions').css('display', 'block');

		$('#my-wallet .publicKey').text(wallet.public);
		$('#my-wallet .balance').text(`${wallet.balance}`);

		wallet.loadBalance();
		wallet.loadNodeInfo();
		wallet.updateRecieverAddressMasterNode();
		await initTransactions();
	
		$('#node-startValidating').on('click', async e => {
			if (!wallet.nodeInValidators) {
				await wallet.startNodeToValidate();
			}
		})
	}
}

async function initTransactions() {
	candy = new Candy(wallet.nodes).start();
	candy.recieverAddress = `${wallet.public}`;

	let transferTimeout = null;
	candy.starwave.registerMessageHandler(`transfers`, async (message) => {
		if (message.sender === wallet.nodeRecieverAddress) {
			clearTimeout(transferTimeout);
			transferTimeout = setTimeout(async () => {
				clearTimeout(transferTimeout);
				await wallet.loadBalance();
				await wallet.loadNodeInfo();
				await wallet.updateRecieverAddressMasterNode();
			}, 300);
			console.log('new message', message);
		}
	})
}
