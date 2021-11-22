const updateQuery = (table, newValues, where) => {
    let query = `UPDATE ${table} SET `;

    const updateKeys = Object.keys(newValues);
    for (let i = 0; i < updateKeys.length; i++) {
        let value;
        if (typeof newValues[updateKeys[i]] === "string") {
            value = newValues[updateKeys[i]].replace(/'/g, "''")
        } else {
            value = newValues[updateKeys[i]]
        }
        if (i === updateKeys.length - 1) {
            query += `${updateKeys[i]} = '${value}' `
        } else {
            query += `${updateKeys[i]} = '${value}', `
        }
    }

    const whereKeys = Object.keys(where);
    query += `WHERE `
    for (let j = 0; j < whereKeys.length; j++) {
        let value;
        if (typeof where[whereKeys[j]] === "string") {
            value = where[whereKeys[j]].replace(/'/g, "''")
        } else {
            value = where[whereKeys[j]]
        }
        if (j === whereKeys.length - 1) {
            query += `${whereKeys[j]} = '${value}'`
        } else {
            query += `${whereKeys[j]} = '${value}' and `
        }
    }
    return query;
}

const selectAllQuery = (table, where) => {
    let query = `SELECT * FROM ${table} WHERE `;

    const whereKeys = Object.keys(where);
    for (let i = 0; i < whereKeys.length; i++) {
        let value;
        if (typeof where[whereKeys[i]] === "string") {
            value = where[whereKeys[i]].replace(/'/g, "''")
        } else {
            value = where[whereKeys[i]]
        }
        if (i === whereKeys.length - 1) {
            query += `${whereKeys[i]} = '${value}'`
        } else {
            query += `${whereKeys[i]} = '${value}' and `
        }
    }
    return query;
}

const selectQuery = (table, targetKeys, where) => {
    let query = `SELECT `

    for (let i = 0; i < targetKeys.length; i++) {
        if (i === targetKeys.length - 1) {
            query += `${targetKeys[i]} `
        } else {
            query += `${targetKeys[i]}, `
        }
    }

    query += `FROM ${table} WHERE `
    const whereKeys = Object.keys(where);
    for (let i = 0; i < whereKeys.length; i++) {
        let value;
        if (typeof where[whereKeys[i]] === "string") {
            value = where[whereKeys[i]].replace(/'/g, "''")
        } else {
            value = where[whereKeys[i]]
        }
        if (i === whereKeys.length - 1) {
            query += `${whereKeys[i]} = '${value}'`
        } else {
            query += `${whereKeys[i]} = '${value}' and `
        }
    }

    return query;
}

const insertQuery = (table, values) => {
    let query = `INSERT INTO ${table}(`

    const keys = Object.keys(values);
    for (let i = 0; i < keys.length; i++) {
        if (i === keys.length - 1) {
            query += `${keys[i]}) VALUES (`
        } else {
            query += `${keys[i]}, `
        }
    }

    for (let i = 0; i < keys.length; i++) {
        let value;
        if (typeof values[keys[i]] === "string") {
            value = values[keys[i]].replace(/'/g, "''")
        } else {
            value = values[keys[i]]
        }
        if (i === keys.length - 1) {
            query += `'${value}')`
        } else {
            query += `'${value}', `
        }
    }
    return query;
}

module.exports = {
    insertQuery,
    selectQuery,
    selectAllQuery,
    updateQuery
}