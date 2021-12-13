const mysql = require('mysql');
const config = require('../../config/config');
const connection = mysql.createConnection(config.SQL);
const ApiError = require('../error/api-error');
const query = require('../../config/query');
const address = require('../../config/address').IP;
const {checkAdmin} = require("../auth/auth.controller");
const { dirname } = require('path');
const fs = require("fs");
const { constants, promises: { access } } = require('fs');
const appDir = dirname(require.main.filename);


exports.registerMember = (req, res, next) => {
    const {rank, name, email, phone, research_area, id, idx} = req.body;
    let file = req.file;
    let accessToken = req.headers['x-access-token'];

    if (id && idx) {
        checkAdmin(id, accessToken).then(
            isAdmin => {
                if (isAdmin) {
                    if (rank && name) {
                        const insertQuery = query.insertQuery('member', {
                            member_rank: rank,
                            member_name: name,
                            member_email: email,
                            member_phone: phone,
                            member_research_area: research_area,
                            member_image: !file ? null : file.filename
                        })
                        connection.query(insertQuery, function (error, results, fields) {
                            if (error) {
                                console.log('Register member failure');
                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                return;
                            }
                            if (results.affectedRows === 1) {
                                res.status(200).json({
                                    'status': 200,
                                    'msg': 'Register member content success'
                                });
                            }
                            else {
                                console.log('Register member failed')
                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                            }
                        })
                    }
                    else {
                        console.log('Please input all data')
                        next(ApiError.badRequest('Please input all data'));
                    }
                }
                else {
                    next(ApiError.badRequest('No control over create member content'))
                }
            },
            () => {
                console.log('Error occurred during checking admin before creating member content')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        )
    }
    else {
        console.log('Please input user id or member idx')
        next(ApiError.badRequest('Invalid access. Please logout and try again.'));
    }
}

exports.readMemberByIdx = (req, res, next) => {
    const {idx} = req.params;
    const selectQuery = query.selectAllQuery('member', {idx: idx});
    if (idx) {
        connection.query(selectQuery, async function (error, results, fields) {
            if (error) {
                console.log('Error occurred during reading member data')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                return;
            }
            if (results.length > 0) {
                const result = {
                    idx: results[0]['idx'],
                    rank: results[0]['member_rank'],
                    name: results[0]['member_name'],
                    imgSrc: `${address.ip}:${address.port}/${address.path}/${results[0]['member_image']}`,
                    email: results[0]['member_email'],
                    phone: results[0]['member_phone'],
                    researchArea: results[0]['member_research_area'],
                }
                res.status(200).json({
                    msg: 'Read member data success',
                    status: 200,
                    data: result
                })
            } else {
                console.log('No member data')
                next(ApiError.badRequest('No member data'))
            }
        })
    }
    else {
        console.log('Error occurred during read member content by idx')
        next(ApiError.badRequest('Please input member idx'))
    }
}

exports.readAllMembers = (req, res, next) => {
    const selectAllQuery = 'SELECT * FROM member';
    connection.query(selectAllQuery, async function (error, results, fields) {
        if (error) {
            console.log('Error occurred during reading all member data')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            return;
        }
        if (results.length > 0) {
            let totalResults = [];
            for (let i = 0; i < results.length; i++) {
                let result = {
                    idx: results[i]['idx'],
                    rank: results[i]['member_rank'],
                    name: results[i]['member_name'],
                    imgSrc: `${address.ip}:${address.port}/${address.path}/${results[i]['member_image']}`,
                    email: results[i]['member_email'],
                    phone: results[i]['member_phone'],
                    researchArea: results[i]['member_research_area'],
                }
                totalResults.push(result)
            }
            res.status(200).json({
                msg: 'Read all member data success',
                status: 200,
                data: totalResults
            })
        } else {
            console.log('No member data')
            res.status(200).json({
                msg: 'No member data',
                status: 200,
                data: []
            })
        }
    })
}

exports.updateMember = (req, res, next) => {
    const {rank, name, email, phone, research_area, id, idx} = req.body;
    let accessToken = req.headers['x-access-token'];
    const file = req.file;

    if (id && idx) {
        checkAdmin(id, accessToken).then(
            isAdmin => {
                if (isAdmin) {
                    if (rank && name) {
                        const payload = {
                            member_rank: rank,
                            member_name: name,
                            member_email: email,
                            member_phone: phone,
                            member_research_area: research_area,
                            member_image: !file ? null : file.filename
                        }
                        const updateQuery = query.updateQuery('member', payload, {idx: idx})
                        connection.query(updateQuery, function (err, results) {
                            if (err) {
                                console.log('Error occurred during updating member content')
                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                return;
                            }
                            if (results.affectedRows > 0) {
                                const filePayload = {
                                    member_image: file.filename,
                                }
                                const updateFileQuery = query.updateQuery('member', filePayload, {idx: idx})
                                deleteMemberFiles(idx).then(
                                    () => {
                                        connection.query(updateFileQuery, function (err, results) {
                                            if (err) {
                                                console.log('Error occurred during updating member file')
                                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                                return;
                                            }
                                            if (results.affectedRows > 0) {
                                                res.status(200).json({
                                                    status: 200,
                                                    msg: 'Update member content success'
                                                })
                                            }
                                            else {
                                                console.log('There is nothing to update')
                                                next(ApiError.badRequest('There is nothing to update'))
                                            }
                                        })

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
                        console.log('Please input all data')
                        next(ApiError.badRequest('Please input all data'));
                    }
                }
                else {
                    next(ApiError.badRequest('No control over update member content'))
                }
            },
            () => {
                console.log('Error occurred during checking admin before updating member content')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        )
    }
    else {
        console.log('Please input user_id or member_id')
        next(ApiError.badRequest('Invalid access. Please logout and try again.'));
    }

}

exports.deleteMemberByIdx = (req, res, next) => {
    const {idx, id} = req.body;
    let accessToken = req.headers['x-access-token'];
    if (id && idx) {
        checkAdmin(id, accessToken).then(
            isAdmin => {
                if (isAdmin) {
                    deleteMemberFiles(idx).then(
                        () => {
                            deleteMemberData(idx).then(
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
                console.log('Error occurred during checking admin before deleting member content')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        )
    }
    else {
        next(ApiError.badRequest('Please input all data'))
    }
}

function deleteMemberData (idx) {
    const deleteQuery = `DELETE FROM member WHERE idx = ${idx}`;
    return new Promise(((resolve, reject) => {
        connection.query(deleteQuery, async function (err, results) {
            if (err) {
                reject('Error occurred during deleting member')
            }
            else if (results.affectedRows > 0) {
                resolve('Member data deletion success')
            }
            else {
                reject('That data does not exist already')
            }
        })
    }))
}

function deleteMemberFiles (idx) {
    const selectQuery = query.selectQuery('member', ['member_image'], {idx: idx})
    return new Promise(((resolve, reject) => {
        connection.query(selectQuery, async function (err, results) {
            if (err) {
                reject('Error occurred during reading member file for deleting')
            }
            else if (results.length > 0) {
                let path = `${appDir}/uploads/${results[0]['member_image']}`
                try {
                    await access(path, constants.F_OK);
                    await fs.unlinkSync(path)
                } catch (e) {
                    console.error(`The file path (${path}) does not exist`)
                }
                resolve('Delete member files success');
            }
            else {
                resolve('There is nothing to be attached in this member content')
            }
        })
    }))
}