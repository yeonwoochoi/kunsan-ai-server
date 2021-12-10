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


exports.registerProject = (req, res, next) => {
    const {title, content, from, to, sponsor} = req.body;
    let file = req.file;
    if (title.length > 0 && content.length > 0) {
        const insertQuery = query.insertQuery('project', {
            project_title: title,
            project_content: content,
            project_image_link: !file ? null : file.filename,
            project_from: from,
            project_to: to,
            project_sponsor: sponsor
        })
        connection.query(insertQuery, function (error, results, fields) {
            if (error) {
                console.log('Register project failure');
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                return;
            }
            if (results.affectedRows === 1) {
                res.status(200).json({
                    'status': 200,
                    'msg': 'Register project content success'
                });
            }
            else {
                console.log('Register project failed')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        })
    }
    else {
        console.log('Please input all data')
        next(ApiError.badRequest('Please input all data'));
    }
}

exports.readProjectByIdx = (req, res, next) => {
    const {idx} = req.params;
    const selectQuery = query.selectAllQuery('project', {idx: idx});
    if (idx) {
        connection.query(selectQuery, async function (error, results, fields) {
            if (error) {
                console.log('Error occurred during reading project data')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                return;
            }
            if (results.length > 0) {
                const result = {
                    no: results[0]['idx'],
                    title: results[0]['project_title'],
                    content: results[0]['project_content'],
                    src: `${address.ip}:${address.port}/${address.path}/${results[0]['project_image_link']}`,
                    from: results[0]['project_from'],
                    to: results[0]['project_to'],
                    sponsor: results[0]['project_sponsor'],
                }
                res.status(200).json({
                    msg: 'Read project data success',
                    status: 200,
                    data: result
                })
            } else {
                console.log('No project data')
                next(ApiError.badRequest('No project data'))
            }
        })
    }
    else {
        console.log('Error occurred during read project content by idx')
        next(ApiError.badRequest('Please input project idx'))
    }
}

exports.readProjectAll = (req, res, next) => {
    const selectAllQuery = 'SELECT * FROM project';
    connection.query(selectAllQuery, async function (error, results, fields) {
        if (error) {
            console.log('Error occurred during reading all project data')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            return;
        }
        if (results.length > 0) {
            let totalResults = [];
            for (let i = 0; i < results.length; i++) {
                let result = {
                    no: results[i]['idx'],
                    title: results[i]['project_title'],
                    content: results[i]['project_content'],
                    src: `${address.ip}:${address.port}/${address.path}/${results[i]['project_image_link']}`,
                    from: results[i]['project_from'],
                    to: results[i]['project_to'],
                    sponsor: results[i]['project_sponsor'],
                }
                totalResults.push(result)
            }
            res.status(200).json({
                msg: 'Read all project data success',
                status: 200,
                data: totalResults
            })
        } else {
            console.log('No project data')
            res.status(200).json({
                msg: 'No project data',
                status: 200,
                data: []
            })
        }
    })
}

exports.updateProject = (req, res, next) => {
    const {title, content, from, to, sponsor, id, idx} = req.body;
    let accessToken = req.headers['x-access-token'];
    const file = req.file;

    if (id && idx) {
        checkAdmin(id, accessToken).then(
            isAdmin => {
                if (isAdmin) {
                    if (title.length > 0 && content.length > 0) {
                        const payload = {
                            project_title: title,
                            project_content: content,
                            project_from: from,
                            project_to: to,
                            project_sponsor: sponsor
                        }
                        const updateQuery = query.updateQuery('project', payload, {idx: idx})
                        connection.query(updateQuery, function (err, results) {
                            if (err) {
                                console.log('Error occurred during updating project content')
                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                return;
                            }
                            if (results.affectedRows > 0) {
                                const filePayload = {
                                    project_image_link: file.filename,
                                }
                                const updateFileQuery = query.updateQuery('project', filePayload, {idx: idx})
                                deleteProjectFiles(idx).then(
                                    () => {
                                        connection.query(updateFileQuery, function (err, results) {
                                            if (err) {
                                                console.log('Error occurred during updating project file')
                                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                                return;
                                            }
                                            if (results.affectedRows > 0) {
                                                res.status(200).json({
                                                    status: 200,
                                                    msg: 'Update project content success'
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
                    next(ApiError.badRequest('No control over update project content'))
                }
            },
            () => {
                console.log('Error occurred during checking admin before updating project content')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        )
    }
    else {
        console.log('Please input user_id or project_id')
        next(ApiError.badRequest('Invalid access. Please logout and try again.'));
    }

}

exports.deleteProjectByIdx = (req, res, next) => {
    const {idx, id} = req.body;
    let accessToken = req.headers['x-access-token'];
    if (id && idx) {
        checkAdmin(id, accessToken).then(
            isAdmin => {
                if (isAdmin) {
                    deleteProjectFiles(idx).then(
                        () => {
                            deleteProjectData(idx).then(
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
                console.log('Error occurred during checking admin before deleting project content')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        )
    }
    else {
        next(ApiError.badRequest('Please input all data'))
    }
}

function deleteProjectData (idx) {
    const deleteQuery = `DELETE FROM project WHERE idx = ${idx}`;
    return new Promise(((resolve, reject) => {
        connection.query(deleteQuery, async function (err, results) {
            if (err) {
                reject('Error occurred during deleting project')
            }
            else if (results.affectedRows > 0) {
                resolve('Project data deletion success')
            }
            else {
                reject('That data does not exist already')
            }
        })
    }))
}

function deleteProjectFiles (idx) {
    const selectQuery = query.selectQuery('project', ['project_image_link'], {idx: idx})
    return new Promise(((resolve, reject) => {
        connection.query(selectQuery, async function (err, results) {
            if (err) {
                reject('Error occurred during reading project file for deleting')
            }
            else if (results.length > 0) {
                let path = `${appDir}/uploads/${results[0]['project_image_link']}`
                try {
                    await access(path, constants.F_OK);
                    await fs.unlinkSync(path)
                } catch (e) {
                    console.error(`The file path (${path}) does not exist`)
                }
                resolve('Delete project files success');
            }
            else {
                resolve('There is nothing to be attached in this project content')
            }
        })
    }))
}