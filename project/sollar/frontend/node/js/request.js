
class Request {
    request(method, args, call_type, contractAddress=wallet.master_contract_address) {
        return new Promise((resolve, reject) => {
            const url = `${API_PREFIX}/contracts/ecma/${call_type}/${contractAddress}/${method}`;
            const body = {
                'args[]': args
            };

            fetch(url, {
                method: 'post',
                body
            })
            .then(res => {
                resolve(res.json())
            })
            .catch(reject)
        });
    }

    callMethodRollback(method, args, contractAddress) {
        return this.request(method, args, 'callMethod', contractAddress);
    }

    deployMethod(method, args, contractAddress) {
        return this.request(method, args, 'deployMethod', contractAddress);
    }
}

const request = new Request();
