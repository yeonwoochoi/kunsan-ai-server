const mysql = require('mysql');
const config = require('../config/config');
const dbConfig = require('../config/db_config');
const connection = mysql.createConnection(dbConfig.SQL);
const { dirname } = require('path');
const fs = require("fs");
const { constants, promises: { access } } = require('fs');
const appDir = dirname(require.main.filename);

function parseJwt(token) {
    let base64Payload = token.split('.')[1];
    let payload = Buffer.from(base64Payload, 'base64');
    return JSON.parse(payload.toString());
}

function deleteFiles (idx, selectQuery, key) {
    return new Promise(((resolve, reject) => {
        connection.query(selectQuery, async function (err, results) {
            if (err) {
                reject('Error occurred during reading file')
            }
            else if (results.length > 0) {
                let path = `${appDir}/uploads/${results[0][`${key}`]}`
                try {
                    await access(path, constants.F_OK);
                    await fs.unlinkSync(path)
                } catch (e) {
                    console.error(`The file path (${path}) does not exist`)
                }
                resolve('Delete files success');
            }
            else {
                resolve('There is no file already')
            }
        })
    }))
}

module.exports = {
    parseJwt,
    deleteFiles
}