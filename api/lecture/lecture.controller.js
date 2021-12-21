const mysql = require('mysql');
const config = require('../../config/config');
const connection = mysql.createConnection(config.SQL);
const query = require('../../config/query')
const ApiError = require("../error/api-error");
const {checkAdmin, checkLogin} = require("../auth/auth.controller");
const { dirname } = require('path');
const fs = require("fs");
const { constants, promises: { access } } = require('fs');
const appDir = dirname(require.main.filename);
const address = require('../../config/address').IP;

exports.create = (req, res, next) => {
    console.log('create lecture content called')
    const { title, content, id } = req.body;
    const files = req.files;
    const importance = (req.body.importance === 'true') ? 1 : 0;

    if (title && content && id) {
        const checkUserQuery = query.selectQuery('user', ['user_id'], {'user_id': id});
        connection.query(checkUserQuery, function (error, check_result) {
            if (error) {
                console.log('Register content failure during check user id into db');
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
            else if (check_result.length > 0) {
                const isUser = check_result[0]['user_role'] === 'user'
                let payload = {
                    'lecture_title': title,
                    'lecture_content': JSON.stringify(content),
                    'lecture_importance': importance,
                    'user_id': id,
                }
                if (isUser && importance) {
                    console.log("User cannot register notice")
                    payload.lecture_importance = 0;
                }
                const registerLectureContentQuery = query.insertQuery('lecture', payload);
                connection.query(registerLectureContentQuery, function (error, results) {
                    if (error) {
                        console.log('Register failure during input lecture data into db');
                        next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                        return;
                    }
                    if (results.affectedRows === 1) {
                        if (files.length > 0) {
                            const getLectureIdQuery = query.selectQuery('lecture', ['idx'], payload)
                            connection.query(getLectureIdQuery, function (error, lecture_id_results) {
                                if (error) {
                                    console.log('Register failure during get lecture index into db');
                                    next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                    return;
                                }
                                const last_insert_lecture_id = lecture_id_results[0]['idx'];
                                insertLectureFiles(last_insert_lecture_id, files).then(
                                    msg => {
                                        res.status(200).json({
                                            'status': 200,
                                            'msg': msg
                                        });
                                    },
                                    err => {
                                        next(ApiError.badRequest(err));
                                    }
                                )
                            })
                        }
                        else {
                            res.status(200).json({
                                'status': 200,
                                'msg': 'Register lecture content success'
                            });
                        }
                    }
                    else {
                        console.log('Register lecture content failed')
                        next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                    }
                })
            }
            else {
                next(ApiError.badRequest('This is an unsigned email. Please log in again.'));
            }
        })
    } else {
        next(ApiError.badRequest('Please fill in all the values'));
    }

}

exports.readAll = (req, res, next) => {
    const selectAllQuery = 'SELECT * FROM lecture'
    connection.query(selectAllQuery, async function (error, results) {
        if (error) {
            console.log('Error occurred during reading all lecture data')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            return;
        }
        if (results.length > 0) {
            let totalResults = await mergeLectureContents(results);
            if (!totalResults) {
                console.log('An error occurred in the process of merging lecture contents')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
            else {
                res.status(200).json({
                    msg: 'Read all lecture data success',
                    status: 200,
                    data: totalResults
                })
            }
        } else {
            console.log('No lecture data')
            res.status(200).json({
                msg: 'There is no data',
                status: 200,
                data: []
            })
        }
    })
}

exports.readByIndex = (req, res, next) => {
    const {idx} = req.params;
    const selectAllQuery = `SELECT * FROM lecture where idx = ${idx}`
    connection.query(selectAllQuery, async function (error, results) {
        if (error) {
            console.log('Error occurred during reading lecture data')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            return;
        }
        if (results.length > 0) {
            let result = {
                idx: results[0].idx,
                title: results[0].lecture_title,
                content: results[0].lecture_content,
                created_at: results[0]['lecture_created_at'].toISOString().split("T")[0],
                view_count: results[0]['lecture_view_count'],
                importance: results[0].lecture_importance,
                author: results[0].user_id,
                comments: [],
                attach: []
            };
            try {
                let asyncResults = await Promise.all([getUserName(result.author), getLectureComments(result.idx), getLectureFiles(result.idx)]);
                result.author = asyncResults[0];
                result.comments = asyncResults[1];
                result.attach = asyncResults[2];
            } catch (e) {
                next(ApiError.badRequest(e));
            }
            res.status(200).json({
                msg: 'Read lecture data success',
                status: 200,
                data: result
            })
        }
        else {
            console.log('No lecture data')
            res.status(200).json({
                msg: 'There is no data',
                status: 200,
                data: {}
            })
        }
    })
}

exports.addViewCount = (req, res, next) => {
    const {idx} = req.params;
    const updateQuery = `UPDATE lecture SET lecture_view_count = lecture_view_count + 1 WHERE idx = ${idx}`

    connection.query(updateQuery, function (error, results) {
        if (error) {
            console.log('Error occurred during updating lecture view count')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            return;
        }
        if (results.affectedRows > 0) {
            res.status(200).json({
                msg: 'Updating lecture view count success',
                status: 200,
            })
        } else {
            next(ApiError.badRequest('There is no lecture content corresponding to the index in request body. Please check again.'));
        }
    })
}

exports.getTotalPage = async (req, res, next) => {
    let {itemPerPage, searchBy, keyword} = req.body;
    if (!itemPerPage) {
        itemPerPage = 10;
    }
    let totalPage = 0;
    let totalDataLength = 0;
    if (keyword) {
        await setSearchConditions(searchBy, keyword).then(
            (conditionQuery) => {
                if (conditionQuery.length === 0) {
                    res.status(200).json({
                        msg: `No lecture results found`,
                        status: 200,
                        data: {
                            totalPage: 1,
                            totalDataLength: 0
                        }
                    })
                } else {
                    let query = `SELECT COUNT(*) as count FROM lecture WHERE ${conditionQuery}`
                    connection.query(query, function (error, results) {
                        if (error) {
                            console.log('Error occurred during getting lecture total count')
                            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                            return;
                        }
                        if (results.length > 0) {
                            totalDataLength = results[0].count
                            totalPage = Math.ceil(results[0].count / itemPerPage)
                            res.status(200).json({
                                msg: 'Get total page count success',
                                status: 200,
                                data: {
                                    totalPage: totalPage,
                                    totalDataLength: totalDataLength
                                }
                            })
                        }
                        else {
                            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                        }
                    })
                }
            },
            () => {
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            })
    }
    else {
        const query = 'SELECT COUNT(*) as count FROM lecture'
        connection.query(query, function (error, results) {
            if (error) {
                console.log('Error occurred during getting lecture total count')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                return;
            }
            if (results.length > 0) {
                totalDataLength = results[0].count
                totalPage = Math.ceil(results[0].count / itemPerPage)
                res.status(200).json({
                    msg: 'Get total page count success',
                    status: 200,
                    data: {
                        totalPage: totalPage,
                        totalDataLength: totalDataLength
                    }
                })
            }
            else {
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        })
    }
}

exports.getLectureContentInPage = async (req, res, next) => {
    let {currentPage, itemPerPage, orderBy, searchBy, keyword} = req.body;

    // Set default value
    if (!itemPerPage) {
        itemPerPage = 10;
    }
    if (!orderBy) {
        orderBy = 'idx'
    }
    if (!searchBy) {
        searchBy = 'total'
    }
    if (!currentPage) {
        currentPage = 1;
    }

    // Convert params to db column name
    let sortBy = 'idx'
    switch (orderBy) {
        case 'no':
            sortBy = 'idx';
            break;
        case 'created_at':
            sortBy = 'lecture_created_at';
            break;
        case 'view_count':
            sortBy = 'lecture_view_count';
            break;
        default:
            sortBy = 'idx';
            break
    }

    let searchColumns;
    switch (searchBy) {
        case 'total':
            searchColumns = 'lecture_title, lecture_content, user_id';
            break;
        case 'title':
            searchColumns = 'lecture_title';
            break;
        case 'content':
            searchColumns = 'lecture_content';
            break;
        default:
            searchColumns = 'idx';
            break
    }

    if (!keyword) {
        const query = `SELECT * FROM lecture ORDER BY FIELD(lecture_importance, 1) DESC, ${sortBy} DESC LIMIT ${(currentPage-1) * itemPerPage}, ${itemPerPage}`;
        connection.query(query, async function (error, results) {
            if (error) {
                console.log('Error occurred during getting lecture content in page ' + currentPage)
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                return;
            }
            if (results.length > 0) {
                let totalResults = await mergeLectureContents(results, currentPage, itemPerPage);
                if (!totalResults) {
                    console.log('An error occurred in the process of merging lecture contents')
                    next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                }
                else {
                    res.status(200).json({
                        msg: `Read lecture content in page ${currentPage} success`,
                        status: 200,
                        data: totalResults
                    })
                }
            }
            else {
                console.log('No lecture data')
                res.status(200).json({
                    msg: 'There is no data',
                    status: 200,
                    data: []
                })
            }
        })
    }
    else {
        await setSearchConditions(searchBy, keyword).then(
            (conditionQuery) => {
                if (conditionQuery.length === 0) {
                    res.status(200).json({
                        msg: `No lecture results found`,
                        status: 200,
                        data: []
                    })
                }
                else {
                    let query = `SELECT * FROM lecture WHERE ${conditionQuery} ORDER BY FIELD(lecture_importance, 1) DESC, ${sortBy} DESC LIMIT ${(currentPage-1) * itemPerPage}, ${currentPage * itemPerPage}`
                    connection.query(query, async function (error, results) {
                        if (error) {
                            console.log('Error occurred during searching lecture contents')
                            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                            return;
                        }
                        if (results.length > 0) {
                            let totalResults = await mergeLectureContents(results, currentPage, itemPerPage);
                            if (!totalResults) {
                                console.log('An error occurred in the process of merging lecture contents')
                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                            }
                            else {
                                res.status(200).json({
                                    msg: `Read lecture content in page ${currentPage} success`,
                                    status: 200,
                                    data: totalResults
                                })
                            }
                        } else {
                            console.log(`No lecture results found`)
                            res.status(200).json({
                                msg: `Read lecture content in page ${currentPage} success`,
                                status: 200,
                                data: []
                            })
                        }
                    })
                }
            },
            () => {
                console.log('Error occurred during searching user name before searching lecture contents')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        );
    }
}

exports.update = (req, res, next) => {
    console.log('update lecture content called')
    const { title, content, id, idx } = req.body;
    const files = req.files;
    const importance = (req.body.importance === 'true') ? 1 : 0;
    console.dir(req.body)
    console.dir(req.files)

    if (title && content && id) {
        const checkUserQuery = `select (select user_role from user where user_id = "${id}") = 'admin' or (select user_id from lecture where idx = "${idx}") = "${id}" as correct;`
        connection.query(checkUserQuery, function (error, check_result) {
            if (error) {
                console.log('Update content failure during check user id into db');
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
            else if (check_result.length > 0) {
                if (check_result[0]['correct'] === 1) {
                    const payload = {
                        lecture_title: title,
                        lecture_content: content,
                        lecture_importance: importance
                    };
                    const updateQuery = query.updateQuery('lecture', payload, {idx: idx, user_id: id})
                    connection.query(updateQuery, function (err, results) {
                        if (err) {
                            console.log('Error occurred during updating lecture content')
                            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                            return;
                        }
                        // update할 때만 해당됨.. insert 할 땐 affectedRows 가 "생성된 rows 수"를 의미
                        // affectedRows : where절로 검색된 rows 수
                        // changedRows : 실제로 update된 rows 수
                        if (results.affectedRows > 0) {
                            deleteFiles(idx, 'lecture_files').then(
                                () => {
                                    updateLectureFiles(idx, files, 'lecture_files').then(
                                        msg => {
                                            res.status(200).json({
                                                status: 200,
                                                msg: msg
                                            })
                                        },
                                        err => {
                                            next(ApiError.badRequest(err))
                                        }
                                    )
                                },
                                err => {
                                    next(ApiError.badRequest(err))
                                }
                            )
                        }
                        else {
                            console.log('There is nothing to update')
                            next(ApiError.badRequest('There is nothing to update'))
                        }
                    })
                }
                else {
                    console.log('Accessed by users other than admin or author');
                    next(ApiError.badRequest('Invalid access. Please logout and try again.'));
                }
            }
            else {
                console.log('Update content failure during check user id into db');
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        })
    }
    else {
        next(ApiError.badRequest('Please fill in all the values'));
    }
}

exports.delete = (req, res, next) => {
    const {idx, id, table} = req.body;
    let accessToken = req.headers['x-access-token'];
    if (id && idx && table) {
        checkLectureAuthor(id, idx, accessToken, table).then(
            (isSame) => {
                if (isSame) {
                    deleteFiles(idx, 'lecture_files').then(
                        () => {
                            deleteLectureData(idx, table).then(
                                msg => {
                                    res.status(200).json({
                                        status: 200,
                                        msg: msg
                                    })
                                },
                                err => {
                                    next(ApiError.badRequest(err))
                                }
                            )
                        },
                        err => {
                            next(ApiError.badRequest(err))
                        }
                    )
                }
                else {
                    next(ApiError.badRequest('No control over deletion'))
                }
            },
            () => {
                console.log('Error occurred during checking lecture author by idx before register comment')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        )
    }
    else {
        next(ApiError.badRequest('Please input all data'))
    }
}

function deleteLectureData (idx, table) {
    const deleteQuery = `DELETE FROM ${table} WHERE idx = ${idx}`;
    return new Promise(((resolve, reject) => {
        connection.query(deleteQuery, async function (err, results) {
            if (err) {
                reject('Error occurred during deleting lecture')
            }
            else if (results.affectedRows > 0) {
                resolve('lecture data deletion success')
            }
            else {
                reject('That data does not exist already')
            }
        })
    }))
}

function deleteFiles (idx, table) {
    const selectQuery = query.selectQuery(table, ['lecture_files_link'], {lecture_id: idx})
    return new Promise(((resolve, reject) => {
        connection.query(selectQuery, async function (err, results) {
            if (err) {
                reject('Error occurred during reading all lecture files for deleting')
            }
            else if (results.length > 0) {
                for (let i = 0; i < results.length; i++) {
                    let path = `${appDir}/uploads/${results[i]['lecture_files_link']}`
                    try {
                        await access(path, constants.F_OK);
                        await fs.unlinkSync(path)
                    } catch (e) {
                        console.error(`The file path (${path}) does not exist`)
                    }
                }
                resolve();
            }
            else {
                console.log('called')
                resolve('There is nothing to be attached in this lecture content')
            }
        })
    }))
}

exports.checkAuthor = (req, res, next) => {
    const {idx, id, table} = req.body;
    const accessToken = req.headers['x-access-token'];
    if (id && idx) {
        checkLectureAuthor(id, idx, accessToken, table).then(
            (isSame) => {
                res.status(200).json({
                    status: 200,
                    msg: 'Check lecture author success',
                    data: {
                        isAuthor: isSame
                    }
                })
            },
            () => {
                console.log('Error occurred during checking lecture author by idx before register comment')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        )
    }
    else {
        next(ApiError.badRequest('Please input all data'))
    }
}

exports.addComment = (req, res, next) => {
    const {id, comment, idx} = req.body;
    if (id && comment && idx) {
        getUserName(id).then(
            () => {
                const checkLectureIdxQuery = query.selectAllQuery('lecture', {'idx': idx})
                connection.query(checkLectureIdxQuery, async function (err, checkResults) {
                    if (err){
                        console.log('Error occurred during checking lecture idx before register comment')
                        next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                        return;
                    }
                    if (checkResults.length > 0) {
                        const addCommentQuery = query.insertQuery('lecture_comment', {
                            'lecture_id': idx,
                            'lecture_comment_content': comment,
                            'user_id': id
                        })
                        connection.query(addCommentQuery, async function (err, results) {
                            if (err){
                                console.log('Error occurred during checking lecture idx before register comment')
                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                return;
                            }
                            if (results.affectedRows === 1) {
                                console.log('Register lecture comment success')
                                res.status(200).json({
                                    status: 200,
                                    msg: 'Register lecture comment success'
                                })
                            }
                            else {
                                console.log('Register lecture comment failed')
                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                            }
                        })
                    }
                    else {
                        next(ApiError.badRequest('lecture idx is not registered. Please try again'));
                    }
                })
            },
            (err) => {
                console.log(err)
                next(ApiError.badRequest('This id is not registered.'))
            }
        )
    }
    else {
        next(ApiError.badRequest('Please input all data'))
    }
}

async function mergeLectureContents(results, page = 1, itemsPerPage = 10) {
    let totalResults = [];
    for (let i = 0; i < results.length; i++) {
        let row = {
            no: i+1+((page-1) * itemsPerPage),
            idx: results[i].idx,
            title: results[i].lecture_title,
            content: results[i].lecture_content,
            created_at: results[i]['lecture_created_at'].toISOString().split("T")[0],
            view_count: results[i]['lecture_view_count'],
            importance: results[i].lecture_importance,
            author: results[i].user_id,
            comments: [],
            attach: []
        };
        try {
            let asyncResults = await Promise.all([getUserName(row.author), getLectureComments(row.idx), getLectureFiles(row.idx)]);
            row.author = asyncResults[0];
            row.comments = asyncResults[1];
            row.attach = asyncResults[2];
            totalResults.push(row)
        } catch (e) {
            return null;
        }
    }
    return totalResults;
}

function checkLectureAuthor(user_id, lecture_id, token, table) {
    return new Promise((resolve, reject) => {
        checkLogin(user_id, token).then(
            () => {
                const checkQuery = `select (select user_id from ${table} where idx = "${lecture_id}") = ("${user_id}") as is_same`
                connection.query(checkQuery, async function (error, results) {
                    if (error) {
                        reject('There is a problem with the server. Please try again in a few minutes.')
                    }
                    else if (results[0]['is_same'] === 1) {
                        resolve(true)
                    } else {
                        checkAdmin(user_id, token).then(
                            isAdmin => {
                                resolve(isAdmin)
                            },
                            () => {
                                reject('There is a problem with the server. Please try again in a few minutes.')
                            }
                        )
                    }
                })
            },
            isUserNotMatchErr => {
                if (isUserNotMatchErr) {
                    reject('Invalid access. Please logout and try again.')
                } else {
                    resolve(false)
                }
            }
        )
    })
}

function getUserName(user_id) {
    return new Promise(((resolve, reject) => {
        const selectQuery = query.selectQuery('user', ['user_name'], {'user_id': user_id})
        connection.query(selectQuery, async function (error, results) {
            if (error) {
                reject('There is a problem with the server. Please try again in a few minutes.')
            }
            else if (results.length > 0) {
                resolve(results[0].user_name)
            } else {
                reject('This is not a registered email. Please log in again.')
            }
        });
    }))
}

function getLectureComments(lecture_id, isLatestOrder = true) {
    return new Promise(((resolve, reject) => {
        const selectQuery = `select lecture_comment.lecture_comment_content, lecture_comment.lecture_comment_created_at, user.user_name from lecture_comment, user where lecture_id = ${lecture_id} and user.user_id = lecture_comment.user_id ORDER BY lecture_comment.lecture_comment_created_at ${isLatestOrder ? 'DESC' : 'ASC'}`;
        connection.query(selectQuery, async function (error, results) {
            if (error) {
                reject('There is a problem with the server. Please try again in a few minutes.')
            }
            else if (results.length > 0) {
                resolve(results.map(x => {
                    let dateArr = x['lecture_comment_created_at'].toISOString().split("T");
                    return {
                        content: x['lecture_comment_content'],
                        created_at: `${dateArr[0]} ${dateArr[1].split(".")[0]}`,
                        author: x['user_name']
                    };
                }))
            } else {
                resolve([])
            }
        });
    }))
}

function getLectureFiles(lecture_id) {
    return new Promise(((resolve, reject) => {
        const selectQuery = query.selectQuery('lecture_files', ['lecture_files_name', 'lecture_files_link'], {lecture_id: lecture_id});
        connection.query(selectQuery, async function (error, results) {
            if (error) {
                reject('There is a problem with the server. Please try again in a few minutes.')
            }
            else if (results.length > 0) {
                resolve(results.map(x => {
                    return {
                        link: `${address.ip}:${address.port}/${address.path}/${x.lecture_files_link}`,
                        name: x.lecture_files_name
                    }
                }))
            } else {
                resolve([])
            }
        });
    }))
}

async function setSearchConditions(searchBy, keyword) {
    return new Promise(((resolve, reject) => {
        if (searchBy === 'author' || searchBy === 'total') {
            const selectUserQuery = `SELECT user_id, user_name FROM user WHERE user_name REGEXP "${keyword}"`;
            connection.query(selectUserQuery, async function (err, userInfos) {
                if (err) {
                    console.log('Error occurred during searching user name before searching lecture contents')
                    reject();
                }
                else {
                    let conditionQuery = ``

                    if (userInfos.length > 0) {
                        for (let i = 0; i < userInfos.length; i++) {
                            conditionQuery += `user_id = "${userInfos[i].user_id}"`
                            if (i < userInfos.length - 1) {
                                conditionQuery += ' or '
                            }
                        }
                        if (searchBy === 'total') {
                            conditionQuery += ` or lecture_title REGEXP "${keyword}" or lecture_content REGEXP "${keyword}" or user_id REGEXP "${keyword}"`
                        }
                    }
                    else if (searchBy === 'total') {
                        conditionQuery += `lecture_title REGEXP "${keyword}" or lecture_content REGEXP "${keyword}" or user_id REGEXP "${keyword}"`
                    }
                    else {
                        console.log(`No lecture results found`)
                        resolve('')
                    }
                    resolve(conditionQuery)
                }
            })
        }
        else if (searchBy === 'title'){
            resolve(`lecture_title REGEXP "${keyword}"`)
        }
        else if (searchBy === 'content') {
            resolve(`lecture_content REGEXP "${keyword}"`)
        }
    }))
}

function updateLectureFiles(idx, files, table) {
    return new Promise(((resolve, reject) => {
        const deleteQuery = `DELETE FROM ${table} WHERE lecture_id = "${idx}"`;
        connection.query(deleteQuery, async function (err) {
            if (err) {
                reject(err)
            }
            else {
                if (files.length > 0) {
                    insertLectureFiles(idx, files).then(
                        msg => {
                            resolve(msg)
                        },
                        err => {
                            reject(err)
                        }
                    )
                }
                else {
                    resolve('There is no input files');
                }
            }
        })
    }))
}

function insertLectureFiles(lecture_id, files){
    return new Promise(((resolve, reject) => {
        let registerAttachQuery = 'INSERT INTO lecture_files (lecture_files_link, lecture_files_name, lecture_id) VALUES ';
        for (let i = 0; i < files.length; i++) {
            registerAttachQuery += `( "${files[i].filename}", "${files[i].originalname}", "${lecture_id}" )`
            if (i < files.length - 1) {
                registerAttachQuery += ', '
            }
        }
        connection.query(registerAttachQuery, function (error, results) {
            if (error) {
                console.log('Register failure during input lecture file data into db');
                reject('There is a problem with the server. Please try again in a few minutes.');
            }
            else if (results.affectedRows > 0) {
                resolve('Register lecture content success')
            }
            else {
                console.log('Register lecture files failed')
                reject('There is a problem with the server. Please try again in a few minutes.')
            }
        })
    }))
}