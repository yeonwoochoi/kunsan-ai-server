const mysql = require("mysql");
const SQL = require('../config/db_config').SQL

let pool = mysql.createPool(SQL);

function getConnection(callback) {
    pool.getConnection(function (err, conn) {
        if(!err) {
            callback(conn);
        }
    });
}

function handleConnectionError(err) {
    console.error(`connection_pool GET Error / ${err}`);
    return "message : Internal Server Error"
}

module.exports = {
    getConnection,
    handleConnectionError
};