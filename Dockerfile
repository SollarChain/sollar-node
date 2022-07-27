FROM node:14

WORKDIR /app

COPY . .

# System
RUN apt update
RUN apt install nano

# Plugins
RUN cd /app/plugins/iz3-bitcore-crypto && npm i

# Node
RUN npm i

CMD ["node", "./main.js"]

EXPOSE 3017 6018