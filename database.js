const sqlite = require('sqlite')
//promise版的sqlite模块

const dbPromise = sqlite.open(__dirname + '/db/chatRoom.sqlite')

module.exports = dbPromise