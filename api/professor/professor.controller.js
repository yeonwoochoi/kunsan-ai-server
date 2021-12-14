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


exports.registerProfessor = (req, res, next) => {
    const {rank, name, degree, email, phone, education, experience, affiliation, id} = req.body;
    let file = req.file;
    let accessToken = req.headers['x-access-token'];

    if (id) {
        checkAdmin(id, accessToken).then(
            isAdmin => {
                if (isAdmin) {
                    if (rank && name && email) {
                        const insertQuery = query.insertQuery('professor', {
                            professor_rank: rank,
                            professor_name: name,
                            professor_degree: degree,
                            professor_email: email,
                            professor_phone: phone,
                            professor_education: education,
                            professor_experience: experience,
                            professor_affiliation: affiliation,
                            professor_image: !file ? null : file.filename
                        })
                        connection.query(insertQuery, function (error, results, fields) {
                            if (error) {
                                console.log('Register professor failure');
                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                return;
                            }
                            if (results.affectedRows === 1) {
                                res.status(200).json({
                                    'status': 200,
                                    'msg': 'Register professor content success'
                                });
                            }
                            else {
                                console.log('Register professor failed')
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
                    next(ApiError.badRequest('No control over create professor content'))
                }
            },
            () => {
                console.log('Error occurred during checking admin before creating professor content')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        )
    }
    else {
        console.log('Please input user id or professor idx')
        next(ApiError.badRequest('Invalid access. Please logout and try again.'));
    }
}

exports.readProfessorByIdx = (req, res, next) => {
    const {idx} = req.params;
    const selectQuery = query.selectAllQuery('professor', {idx: idx});
    if (idx) {
        connection.query(selectQuery, async function (error, results, fields) {
            if (error) {
                console.log('Error occurred during reading professor data')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                return;
            }
            if (results.length > 0) {
                const result = {
                    idx: results[0]['idx'],
                    rank: results[0]['professor_rank'],
                    name: results[0]['professor_name'],
                    degree: results[0]['professor_degree'],
                    email: results[0]['professor_email'],
                    phone: results[0]['professor_phone'],
                    education: results[0]['professor_education'],
                    experience: results[0]['professor_experience'],
                    affiliation: results[0]['professor_affiliation'],
                    imgSrc: `${address.ip}:${address.port}/${address.path}/${results[0]['professor_image']}`,
                }
                res.status(200).json({
                    msg: 'Read professor data success',
                    status: 200,
                    data: result
                })
            } else {
                console.log('No professor data')
                next(ApiError.badRequest('No professor data'))
            }
        })
    }
    else {
        console.log('Error occurred during read professor content by idx')
        next(ApiError.badRequest('Please input professor idx'))
    }
}

exports.readAllProfessor = (req, res, next) => {
    const selectAllQuery = 'SELECT * FROM professor';
    connection.query(selectAllQuery, async function (error, results, fields) {
        if (error) {
            console.log('Error occurred during reading all professor data')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            return;
        }
        if (results.length > 0) {
            res.status(200).json({
                msg: 'Read all professor data success',
                status: 200,
                data: processProfessorContents(results)
            })
        } else {
            console.log('No professor data')
            res.status(200).json({
                msg: 'No professor data',
                status: 200,
                data: []
            })
        }
    })
}

exports.updateProfessor = (req, res, next) => {
    const {rank, name, degree, email, phone, education, experience, affiliation, id, idx} = req.body;
    let accessToken = req.headers['x-access-token'];
    const file = req.file;

    if (id && idx) {
        checkAdmin(id, accessToken).then(
            isAdmin => {
                if (isAdmin) {
                    if (rank && name && email) {
                        const payload = {
                            professor_rank: rank,
                            professor_name: name,
                            professor_degree: degree,
                            professor_email: email,
                            professor_phone: phone,
                            professor_education: education,
                            professor_experience: experience,
                            professor_affiliation: affiliation,
                            professor_image: !file ? null : file.filename
                        }
                        const updateQuery = query.updateQuery('professor', payload, {idx: idx})
                        connection.query(updateQuery, function (err, results) {
                            if (err) {
                                console.log('Error occurred during updating professor content')
                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                return;
                            }
                            if (results.affectedRows > 0) {
                                const filePayload = {
                                    professor_image: file.filename,
                                }
                                const updateFileQuery = query.updateQuery('professor', filePayload, {idx: idx})
                                deleteProfessorFiles(idx).then(
                                    () => {
                                        connection.query(updateFileQuery, function (err, results) {
                                            if (err) {
                                                console.log('Error occurred during updating professor file')
                                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                                return;
                                            }
                                            if (results.affectedRows > 0) {
                                                res.status(200).json({
                                                    status: 200,
                                                    msg: 'Update professor content success'
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
                    next(ApiError.badRequest('No control over update professor content'))
                }
            },
            () => {
                console.log('Error occurred during checking admin before updating professor content')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        )
    }
    else {
        console.log('Please input user_id or professor_id')
        next(ApiError.badRequest('Invalid access. Please logout and try again.'));
    }

}

exports.deleteProfessorByIdx = (req, res, next) => {
    const {idx, id} = req.body;
    let accessToken = req.headers['x-access-token'];
    if (id && idx) {
        checkAdmin(id, accessToken).then(
            isAdmin => {
                if (isAdmin) {
                    deleteProfessorFiles(idx).then(
                        () => {
                            deleteProfessorData(idx).then(
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
                console.log('Error occurred during checking admin before deleting professor content')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        )
    }
    else {
        next(ApiError.badRequest('Please input all data'))
    }
}

function deleteProfessorData (idx) {
    const deleteQuery = `DELETE FROM professor WHERE idx = ${idx}`;
    return new Promise(((resolve, reject) => {
        connection.query(deleteQuery, async function (err, results) {
            if (err) {
                reject('Error occurred during deleting professor')
            }
            else if (results.affectedRows > 0) {
                resolve('Professor data deletion success')
            }
            else {
                reject('That data does not exist already')
            }
        })
    }))
}

function deleteProfessorFiles (idx) {
    const selectQuery = query.selectQuery('professor', ['professor_image'], {idx: idx})
    return new Promise(((resolve, reject) => {
        connection.query(selectQuery, async function (err, results) {
            if (err) {
                reject('Error occurred during reading professor file for deleting')
            }
            else if (results.length > 0) {
                let path = `${appDir}/uploads/${results[0]['professor_image']}`
                try {
                    await access(path, constants.F_OK);
                    await fs.unlinkSync(path)
                } catch (e) {
                    console.error(`The file path (${path}) does not exist`)
                }
                resolve('Delete professor files success');
            }
            else {
                resolve('There is nothing to be attached in this professor content')
            }
        })
    }))
}

const processProfessorContents = (prevContents) => {
    let results = [];

    let rankRef = [];

    prevContents.forEach(element => {
        let rankTemp = element['professor_rank'];
        if (!rankRef.includes(rankTemp)) {
            rankRef.push(rankTemp)
        }
    })


    rankRef.sort((x, y) => {
        if (x > y) {return 1;}
        if (x < y) {return -1;}
        return 0;
    })

    for (let i = 0; i < rankRef.length; i++) {
        let temp = prevContents.filter(element => element['professor_rank'] === rankRef[i]);
        results.push({
            rank: rankRef[i],
            professors: []
        })
        for (let k = 0; k < temp.length; k++) {
            results[i].professors.push({
                idx: temp[k]['idx'],
                name: temp[k]['professor_name'],
                email: temp[k]['professor_email'],
                phone: temp[k]['professor_phone'],
                degree: temp[k]['professor_degree'],
                education: temp[k]['professor_education'],
                experience: temp[k]['professor_experience'],
                affiliation: temp[k]['professor_affiliation'],
                imgSrc: `${address.ip}:${address.port}/${address.path}/${results[i]['professor_image']}`,
                isConfirmOpen: false,
            })
        }
    }

    return results
}