FROM node:14

WORKDIR /app

COPY . .

# System
RUN apt update
RUN apt install nano

# Plugins
RUN cd /app/plugins/iz3-bitcore-crypto && npm i --quiet --silent

# Node
RUN npm i --quiet --silent

WORKDIR /app/project/sollar
CMD ["node", "--max-old-space-size=4096", "../../main.js", "--config=../../config.json"]

EXPOSE 3017 6018
