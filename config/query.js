const updateQuery = (table, newValues, where) => {
    let query = `UPDATE ${table} SET `;

    const updateKeys = Object.keys(newValues);
    for (let i = 0; i < updateKeys.length; i++) {
        let value = processCondition(newValues, updateKeys[i]);

        if (i === updateKeys.length - 1) {
            query += `${updateKeys[i]} = '${value}' `
        } else {
            query += `${updateKeys[i]} = '${value}', `
        }
    }

    const whereKeys = Object.keys(where);
    query += `WHERE `
    for (let i = 0; i < whereKeys.length; i++) {
        let value = processCondition(where, whereKeys[i]);

        if (i === whereKeys.length - 1) {
            query += `${whereKeys[i]} = '${value}'`
        } else {
            query += `${whereKeys[i]} = '${value}' and `
        }
    }
    return query;
}

const selectAllQuery = (table, where) => {
    let query = `SELECT * FROM ${table} WHERE `;

    const whereKeys = Object.keys(where);
    for (let i = 0; i < whereKeys.length; i++) {
        let value = processCondition(where, whereKeys[i]);

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
        let value = processCondition(where, whereKeys[i]);

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
        let value = processCondition(values, keys[i]);

        if (i === keys.length - 1) {
            query += `'${value}')`
        } else {
            query += `'${value}', `
        }
    }
    return query;
}

function processCondition(values, key) {
    let value;
    if (typeof values[key] === "string") {
        value = values[key].replace(/'/g, "''")
    } else {
        value = values[key]
    }

    if (typeof value === "string") {
        let temp;
        if (value.substring(0, 1) === '"' && value.substring(value.length-1, value.length) === '"') {
            temp = value.slice(1, value.length-1)
            value = temp;
        }
    }
    return value;
}

module.exports = {
    insertQuery,
    selectQuery,
    selectAllQuery,
    updateQuery
}