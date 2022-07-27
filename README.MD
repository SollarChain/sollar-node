![Sollar logo](https://testnet.sollar.tech/static/media/solar-logo.273118e9.svg)

# Sollar node installation guide

To get started, make sure you have software: Git, Docker Engine

## 1. Install using the repository:
   Make a work directory and go to new directory, next you should clone the git Sollar Node repository: https://github.com/SollarChain/sollar-node
   <br><br>
   Use next command for cloning <br>
   ```bash
   # git clone https://github.com/SollarChain/sollar-node.git sollar_blockchain
   ```
   
## 2. To starting node
### Build node:
   Your current directory should be the cloning directory sollar_blockchain<br><br>
   Use next command to build node<br>
   ```bash
   # docker build -t docker-sollar-blockchain .
   ```
### Run node:
   Use next command to run node in the background mode
   ```bash
   # docker run -it -dp 3017:3017 -p 6018:6018 --entrypoint /bin/bash docker-sollar-blockchain
   ```
   If you want to see log on the screen, use next command
   ```bash
   # docker run -it -p 3017:3017 -p 6018:6018 --entrypoint /bin/bash docker-sollar-blockchain
   ```
