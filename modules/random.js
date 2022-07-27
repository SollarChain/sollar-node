/**
 Developed by Sollar Dev Team, IZZZIO Dev Team & main Sollar creator Sergey Glukhota - For All Mankind
 Sollar blockchain - https://sollar.tech
 Copyright © 2022 IZZZIO LLC
 */

module.exports = {
    int: function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    },
    arbitrary: function getRandomArbitrary(min, max) {
        return Math.random() * (max - min) + min;
    }
};
