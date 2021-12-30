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

exports.createBoard = (req, res, next) => {
    console.log('create lecture content called')
    const { title, content, id, year, semester, name } = req.body;
    let accessToken = req.headers['x-access-token'];
    const files = req.files;
    const importance = (req.body.importance === 'true') ? 1 : 0;

    checkAdmin(id, accessToken).then(
        isAdmin => {
            if (isAdmin) {
                if (title && content && id && year && semester && name) {
                    const checkUserQuery = query.selectQuery('user', ['user_id'], {'user_id': id});
                    connection.query(checkUserQuery, function (error, check_result) {
                        if (error) {
                            console.log('Register content failure during check user id into db');
                            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                        }
                        else if (check_result.length > 0) {
                            const selectLectureIdxQuery = query.selectQuery('lecture', ['idx'], {
                                lecture_year: year,
                                lecture_semester: semester,
                                lecture_name: name
                            })
                            connection.query(selectLectureIdxQuery, function (error, lecture_idx_results) {
                                if (error) {
                                    console.log('Register failure during reading lecture idx into db');
                                    next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                }
                                else if (lecture_idx_results.length === 1) {
                                    const lecture_id = lecture_idx_results[0]['idx']
                                    let payload = {
                                        'lecture_id': lecture_id,
                                        'lecture_board_title': title,
                                        'lecture_board_content': JSON.stringify(content),
                                        'lecture_board_importance': importance,
                                        'user_id': id,
                                    }
                                    const registerLectureContentQuery = query.insertQuery('lecture_board', payload);
                                    connection.query(registerLectureContentQuery, function (error, results) {
                                        if (error) {
                                            console.log('Register failure during input lecture board data into db');
                                            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                        }
                                        else if (results.affectedRows === 1) {
                                            if (files.length > 0) {
                                                const getLectureBoardIdQuery = query.selectQuery('lecture_board', ['idx'], payload)
                                                connection.query(getLectureBoardIdQuery, function (error, lecture_board_id_results) {
                                                    if (error) {
                                                        console.log('Register failure during get lecture board index into db');
                                                        next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                                        return;
                                                    }
                                                    const last_insert_lecture_board_id = lecture_board_id_results[0]['idx'];
                                                    insertLectureFiles(last_insert_lecture_board_id, files).then(
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
                                                    'msg': 'Register lecture board content success'
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
                                    next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                }
                            })
                        }
                        else {
                            next(ApiError.badRequest('This is an unsigned email. Please log in again.'));
                        }
                    })
                }
                else {
                    next(ApiError.badRequest('Please fill in all the values'));
                }
            }
            else {
                next(ApiError.badRequest('No control over creating lecture board content'))
            }
        },
        () => {
            console.log('Error occurred during checking admin before register lecture board content')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
        }
    )
}

exports.createLecture = (req, res, next) => {
    const {year, semester, name, id} = req.body;
    let accessToken = req.headers['x-access-token'];
    checkAdmin(id, accessToken).then(
        isAdmin => {
            if (isAdmin) {
                if (year && semester && name) {
                    const insertQuery = query.insertQuery('lecture', {
                        lecture_year: year,
                        lecture_semester: semester,
                        lecture_name: name
                    })
                    connection.query(insertQuery, function (error, results) {
                        if (error) {
                            console.log('Register lecture failure into db');
                            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                        }
                        else if (results.affectedRows === 1) {
                            res.status(200).json({
                                'status': 200,
                                'msg': 'Register lecture success'
                            });
                        }
                        else {
                            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                        }
                    })
                }
                else {
                    next(ApiError.badRequest('Please fill in all the values'));
                }
            }
            else {
                next(ApiError.badRequest('No control over creating lecture'))
            }
        },
        () => {
            console.log('Error occurred during checking admin before register lecture')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
        }
    )
}

exports.readByIndex = (req, res, next) => {
    const {idx} = req.params;
    const selectAllQuery = `SELECT * FROM lecture_board where idx = ${idx}`
    connection.query(selectAllQuery, async function (error, results) {
        if (error) {
            console.log('Error occurred during reading lecture data')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            return;
        }
        if (results.length > 0) {
            let result = {
                idx: results[0]['idx'],
                title: results[0]['lecture_board_title'],
                content: results[0]['lecture_board_content'],
                created_at: results[0]['lecture_board_created_at'].toISOString().split("T")[0],
                view_count: results[0]['lecture_board_view_count'],
                importance: results[0]['lecture_board_importance'],
                author: results[0]['user_id'],
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
                msg: 'Read lecture board data success',
                status: 200,
                data: result
            })
        }
        else {
            console.log('No lecture board data')
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
    const updateQuery = `UPDATE lecture_board SET lecture_board_view_count = lecture_board_view_count + 1 WHERE idx = ${idx}`

    connection.query(updateQuery, function (error, results) {
        if (error) {
            console.log('Error occurred during updating lecture board view count')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            return;
        }
        if (results.affectedRows > 0) {
            res.status(200).json({
                msg: 'Updating lecture board view count success',
                status: 200,
            })
        } else {
            next(ApiError.badRequest('There is no lecture board content corresponding to the index in request body. Please check again.'));
        }
    })
}

exports.getTotalPage = async (req, res, next) => {
    let {itemPerPage, searchBy, keyword, year, semester, name} = req.body;
    if (!year || !name || !semester) {
        console.log(`Please input all data during get total page`)
        next(ApiError.badRequest('Please input all data'))
        return;
    }
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
                    let query = `SELECT COUNT(*) as count FROM lecture_board WHERE (${conditionQuery}) and (lecture_id = (SELECT idx FROM lecture WHERE lecture_year="${year}" and lecture_semester="${semester}" and lecture_name="${name}"))`
                    connection.query(query, function (error, results) {
                        if (error) {
                            console.log('Error occurred during getting lecture board total count')
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
        const query = `SELECT COUNT(*) as count FROM lecture_board WHERE lecture_id = (SELECT idx FROM lecture WHERE lecture_year="${year}" and lecture_semester="${semester}" and lecture_name="${name}")`
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
    let {currentPage, itemPerPage, orderBy, searchBy, keyword, year, semester, name} = req.body;

    // Set default value
    if (!year || !name || !semester) {
        console.log(`Please input all data during get lecture content in page`)
        next(ApiError.badRequest('Please input all data'))
        return;
    }
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
            sortBy = 'lecture_board_created_at';
            break;
        case 'view_count':
            sortBy = 'lecture_board_view_count';
            break;
        default:
            sortBy = 'idx';
            break
    }

    let searchColumns;
    switch (searchBy) {
        case 'total':
            searchColumns = 'lecture_board_title, lecture_board_content, user_id';
            break;
        case 'title':
            searchColumns = 'lecture_board_title';
            break;
        case 'content':
            searchColumns = 'lecture_board_content';
            break;
        default:
            searchColumns = 'idx';
            break
    }

    if (!keyword) {
        const query = `SELECT * FROM lecture_board WHERE lecture_id = (SELECT idx FROM lecture WHERE lecture_year="${year}" and lecture_semester="${semester}" and lecture_name="${name}") ORDER BY FIELD(lecture_board_importance, 1) DESC, ${sortBy} DESC LIMIT ${(currentPage-1) * itemPerPage}, ${itemPerPage}`;
        connection.query(query, async function (error, results) {
            if (error) {
                console.log('Error occurred during getting lecture board content in page ' + currentPage)
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                return;
            }
            if (results.length > 0) {
                let totalResults = await mergeLectureContents(results, currentPage, itemPerPage);
                if (!totalResults) {
                    console.log('An error occurred in the process of merging lecture board contents')
                    next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                }
                else {
                    console.log(`Read lecture board "${name}" in page ${currentPage} success`)
                    res.status(200).json({
                        msg: `Read lecture board content in page ${currentPage} success`,
                        status: 200,
                        data: totalResults
                    })
                }
            }
            else {
                console.log(`No lecture board "${name}" data`)
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
                        msg: `No lecture board results found`,
                        status: 200,
                        data: []
                    })
                }
                else {
                    let query = `SELECT * FROM lecture_board WHERE (${conditionQuery}) and (lecture_id = (SELECT idx FROM lecture WHERE lecture_year="${year}" and lecture_semester="${semester}" and lecture_name="${name}")) ORDER BY FIELD(lecture_board_importance, 1) DESC, ${sortBy} DESC LIMIT ${(currentPage-1) * itemPerPage}, ${currentPage * itemPerPage}`
                    console.log(query)
                    connection.query(query, async function (error, results) {
                        if (error) {
                            console.log('Error occurred during searching lecture board contents')
                            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                            return;
                        }
                        if (results.length > 0) {
                            let totalResults = await mergeLectureContents(results, currentPage, itemPerPage);
                            if (!totalResults) {
                                console.log('An error occurred in the process of merging lecture board contents')
                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                            }
                            else {
                                console.log(`Read lecture board "${name}" in page ${currentPage} success`)
                                res.status(200).json({
                                    msg: `Read lecture board content in page ${currentPage} success`,
                                    status: 200,
                                    data: totalResults
                                })
                            }
                        } else {
                            console.log(`No lecture board "${name}" data`)
                            res.status(200).json({
                                msg: `Read lecture board content in page ${currentPage} success`,
                                status: 200,
                                data: []
                            })
                        }
                    })
                }
            },
            () => {
                console.log('Error occurred during searching user name before searching lecture board contents')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        );
    }
}

exports.update = (req, res, next) => {
    console.log('update lecture board content called')
    const { title, content, id, idx } = req.body;
    const files = req.files;
    const importance = (req.body.importance === 'true') ? 1 : 0;
    let accessToken = req.headers['x-access-token'];

    checkAdmin(id, accessToken).then(
        isAdmin => {
            if (isAdmin) {
                if (title && content && id) {
                    const payload = {
                        lecture_board_title: title,
                        lecture_board_content: content,
                        lecture_board_importance: importance,
                    };
                    const updateQuery = query.updateQuery('lecture_board', payload, {idx: idx, user_id: id})
                    connection.query(updateQuery, function (err, results) {
                        if (err) {
                            console.log('Error occurred during updating lecture board content')
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
                    next(ApiError.badRequest('Please fill in all the values'));
                }
            }
            else {
                next(ApiError.badRequest('No control over updating lecture board content'))
            }
        },
        () => {
            console.log('Error occurred during checking admin before updating lecture board content')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
        }
    )
}

exports.delete = (req, res, next) => {
    const {year, semester, name, id} = req.body;
    const table = 'lecture';
    let accessToken = req.headers['x-access-token'];
    const selectQuery= query.selectQuery('lecture', ['idx'], {
        lecture_year: year,
        lecture_semester: semester,
        lecture_name: name
    })
    connection.query(selectQuery, function (err, results) {
        if (err) {
            console.log('Error occurred during reading lecture idx')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            return;
        }
        if (results.length > 0) {
            const idx = results[0]['idx'];
            if (id && year && semester && name && table) {
                checkAdmin(id, accessToken).then(
                    (isAdmin) => {
                        if (isAdmin) {
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
                        console.log('Error occurred during checking lecture author by idx before remove lecture')
                        next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                    }
                )
            }
            else {
                next(ApiError.badRequest('Please input all data'))
            }
        }
        else {
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
        }
    })
}

exports.deleteBoard = (req, res, next) => {
    const {idx, id} = req.body;
    const table = 'lecture_board';
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
                console.log('Error occurred during checking admin before remove lecture')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        )
    }
    else {
        next(ApiError.badRequest('Please input all data'))
    }
}

exports.deleteComment = (req, res, next) => {
    const {idx} = req.body;
    if (idx) {
        const deleteQuery = `DELETE FROM lecture_comment WHERE idx = ${idx}`
        connection.query(deleteQuery, function (err, results) {
            if (err){
                console.log('Error occurred during deleting lecture comment')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
            else if (results.affectedRows > 0) {
                res.status(200).json({
                    status: 200,
                    msg: 'Delete comment success'
                })
            }
            else {
                next(ApiError.badRequest('That data does not exist already'))
            }
        })
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
                resolve('There is nothing to be attached in this lecture content')
            }
        })
    }))
}

exports.addComment = (req, res, next) => {
    const {id, comment, idx} = req.body;
    if (id && comment && idx) {
        getUserName(id).then(
            () => {
                const checkLectureIdxQuery = query.selectAllQuery('lecture_board', {'idx': idx})
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
            title: results[i]['lecture_board_title'],
            content: results[i]['lecture_board_content'],
            created_at: results[i]['lecture_board_created_at'].toISOString().split("T")[0],
            view_count: results[i]['lecture_board_view_count'],
            importance: results[i]['lecture_board_importance'],
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
        const selectQuery = `SELECT lecture_comment.idx, lecture_comment.lecture_comment_content, lecture_comment.lecture_comment_created_at, user.user_name FROM lecture_comment, user where lecture_id = ${lecture_id} and user.user_id = lecture_comment.user_id ORDER BY lecture_comment.lecture_comment_created_at ${isLatestOrder ? 'DESC' : 'ASC'}`;
        connection.query(selectQuery, async function (error, results) {
            if (error) {
                reject('There is a problem with the server. Please try again in a few minutes.')
            }
            else if (results.length > 0) {
                resolve(results.map(x => {
                    let dateArr = x['lecture_comment_created_at'].toISOString().split("T");
                    return {
                        idx: x['idx'],
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
                        link: `${address.ip}:${address.port}/${address.path}/${x['lecture_files_link']}`,
                        name: x['lecture_files_name']
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
                            conditionQuery += ` or lecture_board_title REGEXP "${keyword}" or lecture_board_content REGEXP "${keyword}" or user_id REGEXP "${keyword}"`
                        }
                    }
                    else if (searchBy === 'total') {
                        conditionQuery += `lecture_board_title REGEXP "${keyword}" or lecture_board_content REGEXP "${keyword}" or user_id REGEXP "${keyword}"`
                    }
                    else {
                        console.log(`No lecture board results found`)
                        resolve('')
                    }
                    resolve(conditionQuery)
                }
            })
        }
        else if (searchBy === 'title'){
            resolve(`lecture_board_title REGEXP "${keyword}"`)
        }
        else if (searchBy === 'content') {
            resolve(`lecture_board_content REGEXP "${keyword}"`)
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

exports.getLectureList = (req, res, next) => {
    const selectQuery = query.selectAllQuery('lecture')
    connection.query(selectQuery, function (err, results) {
        if (err) {
            console.log(`Failure during finding lectures into db`);
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
        }
        else if (results.length > 0) {
            console.log(`Find lectures success`)
            res.status(200).json({
                msg: 'Read lectures success',
                status: 200,
                data: processLectureData(results)
            })
        }
        else {
            console.log(`There is no lecture.`)
            res.status(200).json({
                msg: `There is no lecture.`,
                status: 200,
                data: []
            })
        }
    })
}

function processLectureData(prevContents) {
    let results = [];

    let yearRef = [];
    let semesterRef = [];

    prevContents.forEach(element => {
        let yearTemp = element['lecture_year'];
        if (!yearRef.includes(yearTemp)) {
            yearRef.push(yearTemp)
        }

        let semesterTemp = element['lecture_semester'];
        if (!semesterRef.includes(semesterTemp)) {
            semesterRef.push(semesterTemp)
        }
    })

    yearRef.sort((x, y) => {
        if (x < y) {return 1;}
        if (x > y) {return -1;}
        return 0;
    })

    semesterRef.sort((x, y) => {
        if (x < y) {return 1;}
        if (x > y) {return -1;}
        return 0;
    })

    for (let i = 0; i < yearRef.length; i++) {
        for (let j = 0; j < semesterRef.length; j++) {
            let temp = prevContents.filter(element => element['lecture_year'] === yearRef[i] && element['lecture_semester'] === semesterRef[j]);
            if (temp.length > 0) {
                results.push({
                    year: yearRef[i],
                    semester: semesterRef[j],
                    name: []
                })
                for (let k = 0; k < temp.length; k++) {
                    results[results.length-1].name.push(temp[k]['lecture_name'])
                }
            }
        }
    }

    return results
}

exports.isAdmin = (req, res, next ) => {
    const { id } = req.body;
    let accessToken = req.headers['x-access-token'];

    checkAdmin(id, accessToken).then(
        isAdmin => {
            if (isAdmin) {
                res.status(200).json({
                    'status': 200,
                    'msg': 'Check admin success',
                    'data': {
                        isAdmin: isAdmin
                    }
                });
            }
            else {
                next(ApiError.badRequest('No control over creating or updating lecture board content'))
            }
        },
        () => {
            console.log('Error occurred during checking admin before register lecture board content')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
        }
    )
}

exports.checkCommentAuthor = (req, res, next) => {
    const {id, idx} = req.body;
    const accessToken = req.headers['x-access-token'];
    if (id && idx) {
        checkLogin(id, accessToken).then(
            () => {
                const checkQuery = `SELECT user_id FROM lecture_comment WHERE idx = "${idx}"`
                connection.query(checkQuery, function (err, results) {
                    if (err){
                        console.log('Error occurred during checking lecture idx before register comment')
                        next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                        return;
                    }
                    if (results.length > 0) {
                        console.log('check lecture comment author success')
                        res.status(200).json({
                            status: 200,
                            msg: 'check lecture comment author success',
                            data: {
                                isAuthor: results[0]['user_id'] === id
                            }
                        })
                    }
                    else {
                        res.status(200).json({
                            status: 200,
                            msg: 'check lecture comment author success',
                            data: {
                                isAuthor: false
                            }
                        })
                    }
                })
            },
            () => {
                console.log('Error occurred during check login for checking comment author')
                next(ApiError.badRequest('Check lecture comment author failure'))
            }
        )
    }
    else {
        next(ApiError.badRequest('Please input all data'))
    }
}