
/**
 * IZ3 token standard
 * Basic token contract.
 */

const defaultSettings = {
    minFee: 0.0000001,
    blockEmission: 2,
    validatorFee: 200000,
    validatorTimeRange: 1000,
    payForSoul: 1,
    feeCoef: 0.0001,
    ownerWallet: "solCeAT5UqAiaK8tw1A3vUVExm27DThFr2p7",
    recieverAddress: 'node1'
};


class SollarTokenContract extends TokenContract {
    init(initialEmission, mintable) {
        super.init(initialEmission, mintable);

        this._whiteList = new BlockchainMap('whiteList');
        this._whiteListWallets = new BlockchainArray('whiteListWallets');

        this._sollarSettings = new BlockchainMap('sollarSettings');

        this._contract = new KeyValue('_contract');

        this._TransferEvent = new Event('Transfer', 'string', 'string', 'string', 'number', 'number');
        this._TransferFeeEvent = new Event('TransferFeeEvent', 'string', 'string', 'string', 'number', 'number');
        this._ContractFeeEvent = new Event('ContractFeeEvent', 'string', 'string', 'string', 'number', 'number');

        if (contracts.isDeploy()) {
            this._sollarSettings['minFee'] = defaultSettings.minFee;
            this._sollarSettings['blockEmission'] = defaultSettings.blockEmission;
            this._sollarSettings['validatorFee'] = defaultSettings.validatorFee;
            this._sollarSettings['validatorTimeRange'] = defaultSettings.validatorTimeRange;
            this._sollarSettings['payForSoul'] = defaultSettings.payForSoul;
            this._sollarSettings['feeCoef'] = defaultSettings.feeCoef;
            
            this._contract['wallet'] = global.getState().block.wallet;

            const ownerWallet = defaultSettings.ownerWallet;
            this._wallets.mint(ownerWallet, this._sollarSettings['validatorFee']);
            this.addNodeToWhiteList(ownerWallet, this._getSender(), defaultSettings.recieverAddress);
        }
    }

    getNodesCount() {
        return this._whiteListWallets.length;
    }

    _addNodeToWhiteList(ownerWallet, nodeWallet = this._getSender(), recieverAddress) {
        const validatorFee = this._sollarSettings['validatorFee'];

        const wallet = {
            address: nodeWallet,
            recieverAddress,
            owner: ownerWallet,
            amount: validatorFee,
            time_add: Date.now(),
            isActive: true,
            isClaimed: false,
            isValidated: false,
        };

        this._whiteList[nodeWallet] = wallet;
        this._whiteListWallets.push(nodeWallet);
    }

    addNodeToWhiteList(ownerWallet, nodeWallet = this._getSender(), recieverAddress) {
        const validatorFee = this._sollarSettings['validatorFee'];

        console.log('add node', ownerWallet, nodeWallet, recieverAddress);
        assert.false(this._whiteList[nodeWallet], 'Node already added');

        const walletBalance = Number(this.balanceOf(ownerWallet));

        assert.true(walletBalance >= validatorFee, 'Insufficient funds');
        this._wallets.transfer(ownerWallet, this._contract['wallet'], validatorFee);

        return this._addNodeToWhiteList(ownerWallet, nodeWallet, recieverAddress);
    }

    disableNodeFromWhiteList() {
        const address = this._getSender();

        assert.true(this._whiteList[address], 'Node not added');

        const wallet = this._whiteList[address];
        const time_add = wallet.time_add;
        const time_now = Date.now();
        const validatorTimeRange = this._sollarSettings['validatorTimeRange'];

        assert.true(time_now - time_add >= validatorTimeRange, 'Disable node not ready');

        this._wallets.transfer(this._contract['wallet'], wallet.owner, wallet.amount);

        wallet.isActive = false;
        wallet.isClaimed = true;

        this._whiteList[address] = wallet;
    }

    _checkWalletIsCanValidate(wallet, isValidated=false) {
        return wallet.isValidated === isValidated && wallet.isActive === true && wallet.isClaimed === false;
    }

    _isAllNodesValidated() {
        for (const address of this._whiteListWallets) {
            const wallet = this._whiteList[address];
            if (this._checkWalletIsCanValidate(wallet, false)) {
                return false;
            }
        }

        return true;
    }

    getNodeInValidatorsList() {
        for (const address of this._whiteListWallets) {
            const wallet = this._whiteList[address];
            return JSON.stringify(wallet);
        }
    }

    getNodeForValidating() {
        for (const address of this._whiteListWallets) {
            const wallet = this._whiteList[address];
            if (this._checkWalletIsCanValidate(wallet)) {
                return JSON.stringify(wallet);
            }
        }
    }

    checkIsNodeCanValidate(address = this._getSender()) {
        if (!this._whiteList[address]) {
            return false;
        }

        if (this._checkWalletIsCanValidate(this._whiteList[address], true)) {
            return false;
        }

        return true;
    }

    checkIsNodeInValidators(address=this._getSender()) {
        return !!this._whiteList[address];
    }

    checkBlockSign(hash, sign) {
        for (const address of this._whiteListWallets) {
            const wallet = this._whiteList[address];

            if (global.crypto.verifySign(hash, sign, wallet.address)) {
                return true;
            }
        }

        return false;
    }

    resetNodes() {
        assert.assert(this._isAllNodesValidated(), 'Not all nodes is validated');

        for (const address of this._whiteListWallets) {
            const wallet = this._whiteList[address];
            wallet.isValidated = false;
            this._whiteList[address] = wallet;
        }
    }

    _getBlockEmission() {
        return this._sollarSettings['blockEmission'];
    }

    _setNodeIsValidated(nodeAddress = this._getSender(), recieverAddress) {
        assert.true(this._whiteList[nodeAddress], 'Node not in whitelist');
        assert.false(this._checkWalletIsCanValidate(this._whiteList[nodeAddress], true), 'You can\'t validate');

        const wallet = this._whiteList[nodeAddress];
        wallet.isValidated = true;
        this._whiteList[nodeAddress] = wallet;

        const emission = this._getBlockEmission();

        this._wallets.mint(recieverAddress, new BigNumber(emission));
        this._MintEvent.emit(recieverAddress, new BigNumber(emission));
        
        return emission;
    }

    _getTransferFee(amount) {
        const transferAmount = Number((amount / 100 * 1).toFixed(8));
        assert.assert(transferAmount >= this._sollarSettings['minFee'], 'Invalid minimum fee');
        return transferAmount;
    }

    // withdrawFee(from, to=this._getSender(), amount) {
    //     amount = Number(Number(amount).toFixed(8));
    //     assert.true(amount > 0, 'Invalid amount');

    //     const fee = this._getTransferFee(amount);
    //     const amountWithFee = amount + fee;
    //     const walletBalance = Number(this.balanceOf(from));

    //     assert.true(walletBalance - amountWithFee >= 0, 'Insufficient funds');

    //     this._wallets.transfer(from, to, fee);
    //     this._TransferFeeEvent.emit('SOL', sender, wallet.owner, fee, 0);
    //     // this._TransferFeeEvent.emit(from, to, fee);
    //     // this._TransferEvent.emit('SOL', from, to, fee);

    //     this._setNodeIsValidated(to);

    //     return fee;
    // }

    getFeeFromBlock(block) {
        assert.true(block, 'Invalid block');
        const data = block.data;
        const fee = data.length * this._sollarSettings['feeCoef'];
        block.fee = fee;

        return fee;
    }

    calculateBlockFee(state) {
        const sender = state.sender;
        const reciever = state.from;
        const wallet = this._whiteList[reciever];
        const fee = this.getFeeFromBlock(state.block);

        assert.true(fee >= 0, 'Invalid amount');

        const blockEmission = this._setNodeIsValidated(reciever, wallet.owner);

        this._wallets.transfer(sender, wallet.owner, fee);
        this._TransferFeeEvent.emit('SOL', sender, wallet.owner, fee + blockEmission, 0);

        return String(fee);
    }

    getFeeFromContractCode(contractLength) {
        assert.true(contractLength, 'Invalid contract code');
        const fee = contractLength * this._sollarSettings['feeCoef'];

        return fee;
    }

    calculateContractFee(contractData, contractLength, checkBalance=true) {
        const sender = contractData.state.sender;
        const reciever = contractData.state.from;
        const wallet = this._whiteList[reciever];
        const fee = this.getFeeFromContractCode(contractLength);

        if (checkBalance) {
            const senderBalance = new BigNumber(this.balanceOf(sender));
            assert.assert(senderBalance.isGreaterThanOrEqualTo(fee), 'Insufficient funds');
        } else {
            const blockEmission = this._setNodeIsValidated(reciever, wallet.owner);

            this._wallets.transfer(sender, wallet.owner, fee);
            
            this._ContractFeeEvent.emit('SOL', sender, wallet.owner, fee, 0);
            this._TransferFeeEvent.emit('SOL', sender, wallet.owner, fee + blockEmission, 0);
        }
        return String(fee);
    }

    getFreeCoins(wallet, amount) {
        this._transferFromTo(this.contract.owner, wallet, amount);
    }

    transferFromTo(from, to, amount) {
        return this._transferFromTo(from, to, amount);
    }

    _transferFromTo(from, to, amount) {
        assert.true(isFinite(amount), 'Invalid amount');
        amount = Number(Number(amount).toFixed(8));
        assert.true(amount > 0, 'Invalid amount');

        const fee = global.getState().block.fee || 0;

        this._wallets.transfer(from, to, amount);
        this._TransferEvent.emit(this.contract.ticker, from, to, amount, fee);
    }

    balanceOf(address) {
        return this._wallets.balanceOf(address).toFixed(8);
    }
}