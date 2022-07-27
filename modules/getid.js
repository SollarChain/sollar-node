/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */

/**
 * Copied from Stake Overflow
 * @type {function(): string}
 */
module.exports = getid = () => (Math.random() * (new Date().getTime())).toString(36).replace(/[^a-z]+/g, '');
