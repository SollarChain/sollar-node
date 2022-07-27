 /**
  * Minimal zero-cost resources
  * @type {{timeLimit: number, callLimit: number, ram: number}}
  */
 const MINIMAL_RESOURCES = {
     ram: 8,         //MB
     timeLimit: 500, //Milliseconds
     callLimit: 1000,   //per minute
 };
 
 /**
  * Maximum possible resources
  * @type {number}
  */
 const MAX_RESOURCES_COST = 120; //Tokens
 
 /**
  * Default resources price
  * @type {{timeLimit: number, callLimit: number, ram: number}}
  */
 const RESOURCES_PRICE = {
     ram: 2,
     timeLimit: 100,
     callLimit: 1
 };
 
 /**
  * Max size of adding contract
  * @type {number}
  */
 const MAX_CONTRACT_LENGTH = 10 * 1024 * 1024;
 
 /**
  * Main token contract
  */
 class SollarMasterTokenContract extends SollarTokenContract {
 
     /**
      * Contract info
      * @return {{owner: string, ticker: string, name: string}}
      */
     get contract() {
         return {
             name: "SOL NAME",
             ticker: "SOL",
             owner: "",
             backend: "",
             address: {
                 fee: "",
                 block: "",
                 media: "",
             },
             emission: 10000000,
             contract: this._contract['wallet'],
             c2cFee: 0.001,
             type: 'token',
         };
     }
 
     /**
      * Initialization and emission
      */
     init(emission, mintable=true) {
         super.init(emission, mintable);
         /**
          * Resource rents info
          * @type {KeyValue}
          */
         this._resourceRents = new KeyValue('resourceRents');
         this._c2cOrders = new BlockchainMap('c2cOrders');
         this._resourcePrice = new BlockchainMap('resourcePrice');
         this._ResourcesCostChange = new Event('ResourcesCostChange', 'string', 'string');
 
         this._maxContractLength = new KeyValue('maxContractLength');
         this._MaxContractLengthChange = new Event('MaxContractLengthChange', 'string', 'number');
         
         this._Contracts = new BlockchainArray('Contracts');
    
         if (contracts.isDeploy()) {
             this._resourcePrice['ram'] = RESOURCES_PRICE.ram;
             this._resourcePrice['callLimit'] = RESOURCES_PRICE.callLimit;
             this._resourcePrice['timeLimit'] = RESOURCES_PRICE.timeLimit;
             this._ResourcesCostChange.emit('initial', this.getCurrentResources());
 
             this._maxContractLength.put('maxContractLength', MAX_CONTRACT_LENGTH);
             this._MaxContractLengthChange.emit('initial', this.getCurrentMaxContractLength());
         }
     }
 
     /**
      * Used whe payable method is called from the other contract
      * @param {string} contractAddress contract whose method is called
      * @param {number} txValue sending amounts
      * @param {string} methodName
      * @param {array} args method arguments
      */
     processPayableTransaction(contractAddress, txValue, methodName, args) {
         const state = global.getState();
         assert.false(contractAddress === state.contractAddress, 'You can\'t call payment method in token contract');
 
         contractAddress = String(contractAddress);
         txValue = String(txValue);
 
         const oldBalance = this.balanceOf(contractAddress);
 
         this._sendToContract(contractAddress, txValue);
 
         global.contracts.callDelayedMethodDeploy(contractAddress, methodName, args, {
             type: 'pay',
             amount: txValue,
             balance: this.balanceOf(contractAddress),
             oldBalance: oldBalance,
             ticker: this.contract.ticker,
             contractName: this.contract.name
         });
     }
 
     /**
      * Private method, used for sending ZZZ tokens
      * @param {string} contractAddress contract whose method is called
      * @param {number} txValue sending amounts
      */
     _sendToContract(contractAddress, txValue) {
         assert.true(this.checkContractAddress(contractAddress), 'Invalid address');
         this.transfer(contractAddress, txValue);
     }
 
     /**
      * Checks address type actuality
      * @param {string} address contract address
      */
     checkContractAddress(address) {
         let addr = parseFloat(address);
         return !isNaN(addr) && isFinite(address) && addr % 1 === 0;
     }
 
     /**
      * Creates C2C order
      * @param {string} sellerAddress
      * @param {*} args
      * @return {*}
      */
     processC2CBuyRequest(sellerAddress, args) {
         assert.true(this.checkContractAddress(sellerAddress), 'Invalid address');
         assert.true(contracts.isChild(), 'This method can be called only from other contract');
 
         const addressFrom = contracts.caller();
         sellerAddress = String(sellerAddress);
 
         const price = new BigNumber(global.contracts.callMethodDeploy(sellerAddress, 'getPrice', [args]));
         assert.false((new BigNumber(this.balanceOf(addressFrom))).lt(price), 'Insufficient funds for contract buy');
 
         const orderId = this._generateOrderId(sellerAddress, addressFrom, args);
         assert.false(this._c2cOrders[orderId], 'You already have same order');
 
         this._c2cOrders[orderId] = {
             buyerAddress: addressFrom,
             args: args,
             price: price.toFixed(),
             result: false,
         };
 
         contracts.callDelayedMethodDeploy(sellerAddress, 'processC2COrder', [addressFrom, orderId, args]);
         return orderId;
     }
 
     /**
      * Process C2C order
      * @param {string} orderId
      * @param {*} resultData
      */
     processC2CBuyResponse(orderId, resultData) {
         assert.true(contracts.isChild(), 'This method can be called only from other contract');
         assert.true(this._c2cOrders[orderId] !== null && this._c2cOrders[orderId].result === false, 'Order not found or already finished');
 
         const order = this._c2cOrders[orderId];
         order.buyerAddress = String(order.buyerAddress);
         const sellerAddress = String(contracts.caller());
 
         assert.true(this._generateOrderId(sellerAddress, order.buyerAddress, order.args) === orderId, "Order id validity checking error");
 
         const price = new BigNumber(order.price);
         assert.false((new BigNumber(this.balanceOf(order.buyerAddress))).lt(price), 'Insufficient funds for contract buy');
 
         //Saving result
         order.result = resultData;
         this._c2cOrders[orderId] = order;
 
         //Take price
         this._transferFromTo(order.buyerAddress, sellerAddress, price.toFixed());
 
         //Take comission
         const fee = price.times(this.contract.c2cFee);
         const nodeAddress = this._getSender();
         this._transferFromTo(sellerAddress, nodeAddress, fee.toFixed());
 
         contracts.callDelayedMethodDeploy(order.buyerAddress, 'processC2COrderResult', [resultData, orderId, sellerAddress]);
     }
 
     /**
      * Get order result
      * @param {string} orderId
      * @return {*}
      */
     getC2CBuyResult(orderId) {
         assert.true(contracts.isChild(), 'This method can be called only from other contract');
         assert.true(this._c2cOrders[orderId] !== null, 'Order not found or already finished');
         assert.true(this._c2cOrders[orderId].result !== false, 'Order not ready yet');
 
         const order = this._c2cOrders[orderId];
         order.buyerAddress = String(order.buyerAddress);
 
         assert.true(order.buyerAddress === String(contracts.caller()), 'Access denied for this orderId');
 
         return JSON.stringify(order.result);
     }
 
     
     /**
      * Generate order Id by params
      * @param seller
      * @param buyer
      * @param args
      * @return {*}
      * @private
      */
     _generateOrderId(seller, buyer, args) {
         return crypto.hash(seller + '_' + buyer + '_' + args.toString());
     }
 
 
     /**
      * Process new contract deployment
      */
     processDeploy() {
         const state = global.getState();
         const contractAddress = state.contractAddress;
         const contractAddressStr = String(contractAddress);
         const from = state.deployState.from;
         const resourceRent = state.deployState.resourceRent;
         
         assert.true(Number(resourceRent) >= 0, 'Good plan');
         assert.true(Number(resourceRent) <= MAX_RESOURCES_COST, 'You can\'t rent more than possible for ' + MAX_RESOURCES_COST + ' tokens');
        
        //  this._TransferFeeEvent.emit('SOL', sender, wallet.owner, fee + blockEmission, 0);

         if(Number(resourceRent) !== 0) {
            //Transfer rent payment for system account
            this._wallets.transfer(from, this.contract['owner'], resourceRent);
         }
 
         //Saving rent information
         this._resourceRents.put(contractAddressStr, resourceRent);
 
         this._Contracts.push(contractAddressStr);
     }
 
     getContractsAddress() {
         return JSON.stringify(this._Contracts.toArray());
     }
 
     /**
      * Returns calculated resources
      * @param {string} amount
      * @return {{callLimit: number, timeLimit: number, ram: number}}
      */
     calculateResources(amount) {
         amount = Math.abs(Number(amount));
 
         if(amount > MAX_RESOURCES_COST) {
             amount = MAX_RESOURCES_COST;
         }
 
         let ram = this._resourcePrice['ram'] * amount;
         let timeLimit = this._resourcePrice['timeLimit'] * amount;
         let callLimit = this._resourcePrice['callLimit'] * amount;
 
 
         ram = (ram < MINIMAL_RESOURCES.ram) ? MINIMAL_RESOURCES.ram : ram;
         timeLimit = (timeLimit < MINIMAL_RESOURCES.timeLimit) ? MINIMAL_RESOURCES.timeLimit : timeLimit;
         callLimit = (callLimit < MINIMAL_RESOURCES.callLimit) ? MINIMAL_RESOURCES.callLimit : callLimit;
 
         return {ram: Math.round(ram), timeLimit: Math.round(timeLimit), callLimit: Math.round(callLimit)};
     }
 
     /**
      * Returns calculated resources as JSON
      * @param {string} amount
      * @return JSON {{callLimit: number, timeLimit: number, ram: number}}
      */
     getCalculatedResources(amount) {
         return JSON.stringify(this.calculateResources(amount));
     }
 
     /**
      * Returns calculated contracts limits
      * @param address
      */
     checkContractLimits(address) {
         let resourcesAmount = this._resourceRents.get(String(address));
         if(!resourcesAmount) {
             return false;
         }
         return JSON.stringify(this.calculateResources(resourcesAmount));
     }
 
     /**
      * accepting new resources cost after voting
      * @param amount
      */
     _acceptNewResources(newCost) {
         this._resourcePrice['ram'] = newCost.ram;
         this._resourcePrice['timeLimit'] = newCost.timeLimit;
         this._resourcePrice['callLimit'] = newCost.callLimit;
     }
 
     /**
      * accepting new contract size after voting
      * @param newValue
      */
     _acceptNewMaxContractLength(newValue) {
         this._maxContractLength.put('maxContractLength', +newValue);
     }
 
     /**
      * get results og voting contract by its address
      * @param voteContractAddress
      * @returns {any}
      * @private
      */
     _getResultsOfVoting(voteContractAddress) {
         return JSON.parse(contracts.callMethodDeploy(voteContractAddress, 'getResultsOfVoting',[]));
     }
 
     /**
      * Process results of change contract cost voting
      * @param voteContractAddress
      * @returns {number} result of processing: 0 - voting isn't started, 1 - voting hasn't been ended yet, 2 - old variant of cost wins, 3 - new variant of cost wins and accepted, 4 - old var of max contract size wins, 5 new var of max contract size wins and accepted
      */
     processResults(voteContractAddress) {
         const voteResults = this._getResultsOfVoting(voteContractAddress);
         switch (voteResults.state) {
             case 'waiting':
                 return 0;
                 break;
             case 'started':
                 return 1;
                 break;
             case 'ended':
                 let winner = this._findMaxVariantIndex(voteResults.results);
                 if (typeof JSON.parse(winner.index) === 'object'){
                     // if wins the same variant as we have now then do nothing
                     const curResourses = this.getCurrentResources();
                     if (winner.index === curResourses) {
                         this._ResourcesCostChange.emit('not change by voting',curResourses);
                         return 2;
                     } else {
                         this._acceptNewResources(JSON.parse(winner.index));
                         this._ResourcesCostChange.emit('change by voting', curResourses);
                         return 3;
                     }
                 } else {
                     const curMaxLen = this.getCurrentMaxContractLength();
                     if ( +winner.index === curMaxLen) {
                         this._MaxContractLengthChange.emit('not change by voting', curMaxLen);
                         return 4;    
                     } else {
                         this._acceptNewMaxContractLength(JSON.parse(winner.index));
                         this._MaxContractLengthChange.emit('change by voting', curMaxLen);
                         return 5;
                     }
                 }
         }
     }
 
     /**
      * find max element and returns winner's index and value
      * @param map
      * @returns {{index: string, value: number}}
      * @private
      */
     _findMaxVariantIndex(map) {
         let max = {
             index:'',
             value: -1,
         };
         for (let ind in map) {
             if(map.hasOwnProperty(ind)) {
                 if (max.value <= map[ind]) {
                     max.index = ind;
                     max.value = map[ind];
                 }
             }
         }
         return max;
     }
 
     /**
      * get current resources
      * @returns {string}
      */
     getCurrentResources() {
         return JSON.stringify({
             ram: this._resourcePrice['ram'],
             timeLimit: this._resourcePrice['timeLimit'],
             callLimit: this._resourcePrice['callLimit']
         });
     }
 
     /**
      * get current max contract size
      */
     getCurrentMaxContractLength() {
         return Number(this._maxContractLength.get('maxContractLength'));
     }
 
     /**
      * returns resources as string
      * @param obj
      * @returns {string}
      */
     resourcesObjectToString(obj) {
         return `ram:${obj.ram}, time limit:${obj.timeLimit}, call limit:${obj.callLimit}`
     }
 
     /**
      * starts voting contract by address to decide if we need new resouces price or not
      * @param voteContractAddress address of voting contract
      * @param newVariant multiplier for new resources cost (new = old * multiplier)
      */
     startVotingForChangeResourcesPrice(voteContractAddress, newVariant) {
         let newCost = JSON.stringify(this.calculateResources(newVariant));
         let oldCost = this.getCurrentResources();
         contracts.callMethodDeploy(voteContractAddress, 'startVoting',[newCost, oldCost]);
         return JSON.stringify([newCost, oldCost]);
     }
 
     /**
      * starts voting contract by address to decide if we need newMaxContractLength or not
      * @param voteContractAddress address of voting contract
      * @param newVariant multiplier for new resources cost (new = old * multiplier)
      */
     startVotingForChangeMaxContractLength(voteContractAddress, newVariant) {
         let newVal = newVariant;
         let oldVal = this.getCurrentMaxContractLength();
         contracts.callMethodDeploy(voteContractAddress, 'startVoting',[newVal, oldVal]);
         return JSON.stringify([newVal, oldVal]);
     }
 
 }
