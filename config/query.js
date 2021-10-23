const updateQuery = (table, newValues, where) => {
    let query = `UPDATE ${table} SET `;

    const updateKeys = Object.keys(newValues);
    for (let i = 0; i < updateKeys.length; i++) {
        if (i === updateKeys.length - 1) {
            query += `${updateKeys[i]} = "${newValues[updateKeys[i]]}" `
        } else {
            query += `${updateKeys[i]} = "${newValues[updateKeys[i]]}", `
        }
    }

    const whereKeys = Object.keys(where);
    query += `WHERE `
    for (let j = 0; j < whereKeys.length; j++) {
        if (j === whereKeys.length - 1) {
            query += `${whereKeys[j]} = "${where[whereKeys[j]]}"`
        } else {
            query += `${whereKeys[j]} = "${where[whereKeys[j]]}" and `
        }
    }
    return query;
}

const selectAllQuery = (table, where) => {
    let query = `SELECT * FROM ${table} WHERE `;

    const whereKeys = Object.keys(where);
    for (let i = 0; i < whereKeys.length; i++) {
        if (i === whereKeys.length - 1) {
            query += `${whereKeys[i]} = "${where[whereKeys[i]]}"`
        } else {
            query += `${whereKeys[i]} = "${where[whereKeys[i]]}" and `
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
        if (i === whereKeys.length - 1) {
            query += `${whereKeys[i]} = "${where[whereKeys[i]]}"`
        } else {
            query += `${whereKeys[i]} = "${where[whereKeys[i]]}" and `
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
        if (i === keys.length - 1) {
            query += `"${values[keys[i]]}")`
        } else {
            query += `"${values[keys[i]]}", `
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