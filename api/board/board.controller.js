const mysql = require('mysql');
const config = require('../../config/config');
const connection = mysql.createConnection(config.SQL);
let User = require('../../models/user/user');
const crypto = require('crypto');
const jwt = require("jsonwebtoken");
const secret = config.KEY.secret;
const jwt_secret = config.KEY.jwt_secret;
const query = require('../../config/query')
const ApiError = require("../error/api-error");
const {check} = require("../auth/auth.controller");
const ip = require("ip");
const address = require('../../config/address').IP;



exports.create = (req, res, next) => {
    console.log('create board content called')
    const { title, content, importance, user_id } = JSON.parse(req.body.tags);
    const attach = req.files;

    if (title && content && user_id) {
        const checkUserQuery = query.selectQuery('user', ['user_id'], {'user_id': user_id});
        connection.query(checkUserQuery, function (error, check_result, fields) {
            if (error) {
                console.log('Register content failure during check user id into db');
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
            else if (check_result.length > 0) {
                const isUser = check_result[0]['user_role'] === 'user'
                let payload ={
                    'board_title': title,
                    'board_content': content,
                    'board_importance': 0,
                    'user_id': user_id,
                }
                if (!isUser && importance) {
                    console.log("Admin's notice register")
                    payload.board_importance = 1;
                }
                const registerBoardContentQuery = query.insertQuery('board', payload);
                connection.query(registerBoardContentQuery, function (error, results, fields) {
                    if (error) {
                        console.log('Register failure during input board data into db');
                        next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                        return;
                    }
                    if (attach.length > 0) {
                        const getBoardIdQuery = query.selectQuery('board', ['idx'], payload)
                        connection.query(getBoardIdQuery, function (error, board_id_results, fields) {
                            if (error) {
                                console.log('Register failure during get board index into db');
                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                return;
                            }
                            const last_insert_board_id = board_id_results[0]['idx'];
                            let registerAttachQuery = 'INSERT INTO board_files (board_files_name, board_id) VALUES ';
                            for (let i = 0; i < attach.length; i++) {
                                registerAttachQuery += `( "${attach[i].filename}", "${last_insert_board_id}" )`
                                if (i < attach.length - 1) {
                                    registerAttachQuery += ', '
                                }
                            }
                            console.log(registerAttachQuery)
                            connection.query(registerAttachQuery, function (error, results, fields) {
                                if (error) {
                                    console.log('Register failure during input board file data into db');
                                    next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                    return;
                                }

                                res.status(200).json({
                                    'status': 200,
                                    'msg': 'Register board content success'
                                });
                            })
                        })
                    } else {
                        res.status(200).json({
                            'status': 200,
                            'msg': 'Register board content success'
                        });
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
    const selectAllQuery = 'SELECT * FROM board'
    connection.query(selectAllQuery, async function (error, results, fields) {
        if (error) {
            console.log('Error occurred during reading all board data')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            return;
        }
        if (results.length > 0) {
            let totalResults = [];
            for (let i = 0; i < results.length; i++) {
                let row = {
                    no: i+1,
                    idx: results[i].idx,
                    title: results[i].board_title,
                    content: results[i].board_content,
                    created_at: results[i].board_created_at.toISOString().split("T")[0],
                    view_count: results[i].board_view_count,
                    importance: results[i].board_importance,
                    author: results[i].user_id,
                    comments: [],
                    attach: []
                };
                try {
                    let asyncResults = await Promise.all([getUserName(row.author), getBoardComments(row.idx), getBoardFiles(row.idx)]);
                    row.author = asyncResults[0];
                    row.comments = asyncResults[1];
                    row.attach = asyncResults[2];
                    totalResults.push(row)
                } catch (e) {
                    next(ApiError.badRequest(e));
                    return;
                }
            }
            res.status(200).json({
                msg: 'Read all board data success',
                status: 200,
                data: totalResults
            })
        } else {
            console.log('No board data')
            res.status(200).json({
                msg: 'There is no data',
                status: 200,
                data: []
            })
        }
    })
}

exports.read = (req, res, next) => {
    const {idx} = req.params;
    const selectAllQuery = `SELECT * FROM board where idx = ${idx}`
    connection.query(selectAllQuery, async function (error, results, fields) {
        if (error) {
            console.log('Error occurred during reading board data')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            return;
        }
        if (results.length > 0) {
            let result = {
                idx: results[0].idx,
                title: results[0].board_title,
                content: results[0].board_content,
                created_at: results[0].board_created_at.toISOString().split("T")[0],
                view_count: results[0].board_view_count,
                importance: results[0].board_importance,
                author: results[0].user_id,
                comments: [],
                attach: []
            };
            try {
                let asyncResults = await Promise.all([getUserName(result.author), getBoardComments(result.idx), getBoardFiles(result.idx)]);
                result.author = asyncResults[0];
                result.comments = asyncResults[1];
                result.attach = asyncResults[2];
            } catch (e) {
                next(ApiError.badRequest(e));
            }
            res.status(200).json({
                msg: 'Read board data success',
                status: 200,
                data: result
            })
        }
        else {
            console.log('No board data')
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
    const updateQuery = `UPDATE board SET board_view_count = board_view_count + 1 WHERE idx = ${idx}`
    console.log(updateQuery)

    connection.query(updateQuery, function (error, results, fields) {
        if (error) {
            console.log('Error occurred during updating board view count')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            return;
        }
        if (results.affectedRows > 0 && results.changedRows > 0) {
            res.status(200).json({
                msg: 'Updating board view count success',
                status: 200,
            })
        } else {
            next(ApiError.badRequest('There is no board content corresponding to the index in request body. Please check again.'));
        }
    })
}

exports.update = (req, res, next) => {
    const {user_id, board_id} = req.body;
    checkAuthor(user_id, board_id).then(
        (isSame) => {
            if (isSame) {
                res.status(200).json({
                    data: isSame
                })
            }
            else {
                next(ApiError.badRequest('Only the author or admin can edit it.'));
            }
        },
        (err) => {
            next(ApiError.badRequest(err));
        }
    )
}

exports.delete = (req, res, next) => {


}

exports.addComment = (req, res, next) => {


}

function checkAuthor(user_id, board_id) {
    return new Promise((resolve, reject) => {
        const checkQuery = `select (select user_id from board where idx = "${board_id}") = ("${user_id}") as is_same`
        connection.query(checkQuery, async function (error, results, fields) {
            if (error) {
                reject('There is a problem with the server. Please try again in a few minutes.')
            }
            else if (results[0]['is_same'] === 1) {
                resolve(true)
            } else {
                resolve(false)
            }
        })
    })
}

function getUserName(user_id) {
    return new Promise(((resolve, reject) => {
        const selectQuery = query.selectQuery('user', ['user_name'], {'user_id': user_id})
        connection.query(selectQuery, async function (error, results, fields) {
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

function getBoardComments(board_id, isLatestOrder = true) {
    return new Promise(((resolve, reject) => {
        const selectQuery = `select board_comment.board_comment_content, board_comment.board_comment_created_at, user.user_name from board_comment, user where board_id = ${board_id} and user.user_id = board_comment.user_id ORDER BY board_comment.board_comment_created_at ${isLatestOrder ? 'DESC' : 'ASC'}`;
        connection.query(selectQuery, async function (error, results, fields) {
            if (error) {
                reject('There is a problem with the server. Please try again in a few minutes.')
            }
            else if (results.length > 0) {
                resolve(results.map(x => {
                    let dateArr = x['board_comment_created_at'].toISOString().split("T");
                    return {
                        content: x['board_comment_content'],
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

function getBoardFiles(board_id) {
    return new Promise(((resolve, reject) => {
        const selectQuery = query.selectQuery('board_files', ['board_files_name', 'board_files_link'], {board_id: board_id});
        connection.query(selectQuery, async function (error, results, fields) {
            if (error) {
                reject('There is a problem with the server. Please try again in a few minutes.')
            }
            else if (results.length > 0) {
                resolve(results.map(x => {
                    return {
                        link: `${address.ip}:${address.port}/${address.path}/${x.board_files_link}`,
                        name: x.board_files_name
                    }
                }))
            } else {
                resolve([])
            }
        });
    }))
}