/**
 * Explorer
 */

const default_limit = 20;
const default_offset = 0;
const default_page = 1;

const PORT = Number(location.port);
const DOMAIN = document.domain;
let API_PREFIX = `http://${DOMAIN}:${PORT}`;

const nodes = [];

if (PORT == 0) {
    API_PREFIX = location.origin;
    nodes.push('wss://wss.testnet.sollar.tech/');
} else {
    nodes.push(`ws://${DOMAIN}:${PORT + 1 + 3000}`);
}

