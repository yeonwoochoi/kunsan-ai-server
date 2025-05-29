const mysql = require('mysql');
const config = require('../../config/config');
const dbConfig = require('../../config/db_config');
const connection = mysql.createConnection(dbConfig.SQL);
const crypto = require('crypto');
const jwt = require("jsonwebtoken");
const secret = config.KEY.secret;
const jwt_secret = config.KEY.jwt_secret;
const query = require('../../config/query')
const ApiError = require("../error/api-error");
const utils = require("../../util/utils");
const {checkAdmin} = require("../auth/auth.controller");


exports.create = (req, res, next) => {
    const {year, header, title, content, link, id} = req.body;
    const accessToken = req.headers['x-access-token'];
    if (id) {
        if (year && header && title && content && link) {
            checkAdmin(id, accessToken).then(
                isAdmin => {
                    if (isAdmin) {
                        const insertQuery = query.insertQuery('publication', {
                            publication_year: year,
                            publication_header: header,
                            publication_title: title,
                            publication_content: content,
                            publication_link: link
                        })
                        connection.query(insertQuery, async function (err, results) {
                            if (err) {
                                console.log('Create publication contents failure from db');
                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                            }
                            else if (results.affectedRows === 1) {
                                res.status(200).json({
                                    status: 200,
                                    msg: 'Create publication content success'
                                })
                            }
                            else {
                                console.log('Create publication content failure')
                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                            }
                        })
                    }
                    else {
                        next(ApiError.badRequest('No control over creation'))
                    }
                },
                () => {
                    console.log('Error occurred during checking admin before creating publication content')
                    next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                })
        }
        else {
            next(ApiError.badRequest('Please input all data'))
        }
    }
    else {
        next(ApiError.badRequest('No control over creation'))
    }
}

exports.delete = (req, res, next) => {
    const {id, idx} = req.body;
    const accessToken = req.headers['x-access-token'];
    if (id && idx) {
        checkAdmin(id, accessToken).then(
            isAdmin => {
                if (isAdmin) {
                    const deleteQuery = `DELETE FROM publication WHERE idx = ${idx}`
                    connection.query(deleteQuery, async function (err, results) {
                        if (err) {
                            console.log('Delete publication contents failure from db');
                            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                        }
                        else if (results.affectedRows > 0) {
                            res.status(200).json({
                                status: 200,
                                msg: 'Delete publication content success'
                            })
                        }
                        else {
                            next(ApiError.badRequest('That data does not exist already'));
                        }
                    })
                }
                else {
                    next(ApiError.badRequest('No control over deletion'))
                }
            },
            () => {
                console.log('Error occurred during checking admin before deleting publication content')
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        )
    }
    else {
        next(ApiError.badRequest('No control over deletion'))
    }
}

exports.update = (req, res, next) => {
    const {year, header, title, content, link, id, idx} = req.body;
    const accessToken = req.headers['x-access-token'];
    if (id && idx) {
        if (year && header && title && content && link) {
            checkAdmin(id, accessToken).then(
                isAdmin => {
                    if (isAdmin) {
                        const updateQuery = query.updateQuery('publication', {
                            publication_year: year,
                            publication_header: header,
                            publication_title: title,
                            publication_content: content,
                            publication_link: link
                        }, {idx: idx})
                        connection.query(updateQuery, async function (err, results) {
                            if (err) {
                                console.log('Update publication contents failure from db');
                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                            }
                            else if (results.affectedRows > 0) {
                                res.status(200).json({
                                    status: 200,
                                    msg: 'Update publication content success'
                                })
                            }
                            else {
                                console.log('Update publication content failure')
                                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                            }
                        })
                    }
                    else {
                        next(ApiError.badRequest('No control over update'))
                    }
                },
                () => {
                    console.log('Error occurred during checking admin before updating publication content')
                    next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                })
        }
        else {
            next(ApiError.badRequest('Please input all data'))
        }
    }
    else {
        next(ApiError.badRequest('No control over update'))
    }
}

exports.readAll = (req, res, next) => {
    const selectAllQuery = query.selectAllQuery('publication');
    connection.query(selectAllQuery, function (err, results) {
        if (err) {
            console.log('Read all publication contents failure from db');
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
        }
        else if (results.length > 0) {
            res.status(200).json({
                'status': 200,
                'msg': 'Read all publication contents success',
                'data': processPublicationContents(results)
            });
        }
        else {
            res.status(200).json({
                'status': 200,
                'msg': 'There is no publication content.',
                'data': []
            });
        }
    })
}

exports.read = (req, res, next) => {
    const {idx} = req.params;
    if (idx) {
        const selectAllQuery = query.selectAllQuery('publication', {idx: idx});
        connection.query(selectAllQuery, function (err, results){
            if (err) {
                console.log('Read publication content by index failure from db');
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
            else if (results.length > 0) {
                const total_result = {
                    idx: results[0].idx,
                    year: results[0].publication_year,
                    header: results[0].publication_header,
                    title: results[0].publication_title,
                    content: results[0].publication_content,
                    link: results[0].publication_link,
                }
                res.status(200).json({
                    status: 200,
                    msg: 'Read publication content by index success',
                    data: total_result
                })
            }
            else {
                console.log('There is no publication content corresponding to index '+ idx)
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            }
        })
    }
    else {
        next(ApiError.badRequest('Please input all data'))
    }
}

const processPublicationContents = (prevContents) => {
    let results = [];

    let yearRef = [];
    let headerRef = [];

    prevContents.forEach(element => {
        let yearTemp = parseInt(element['publication_year']);
        if (!yearRef.includes(yearTemp)) {
            yearRef.push(yearTemp)
        }

        let headerTemp = element['publication_header'];
        if (!headerRef.includes(headerTemp)) {
            headerRef.push(headerTemp)
        }
    })
    yearRef.sort((a,b) => b-a);
    headerRef.sort((x, y) => {
        if (x > y) {return -1;}
        if (x < y) {return 1;}
        return 0;
    })

    for (let i = 0; i < yearRef.length; i++) {
        let temp = prevContents.filter(element => parseInt(element['publication_year']) === yearRef[i])
        results.push({
            year: yearRef[i],
            data: []
        })
        for (let j = 0; j < headerRef.length; j++) {
            let temp2 = temp.filter(element => element['publication_header'] === headerRef[j]);
            results[i].data.push({
                header: headerRef[j],
                content: []
            })
            for (let k = 0; k < temp2.length; k++) {
                results[i].data[j].content.push({
                    idx: temp2[k]['idx'],
                    title: temp2[k]['publication_title'],
                    content: temp2[k]['publication_content'],
                    link: temp2[k]['publication_link'],
                    isConfirmOpen: false,
                })
            }
        }
    }

    let totalResults = [];
    for (let i = 0; i < results.length; i++) {
        totalResults.push({
            year: results[i].year,
            data: []
        })
        let temp = results[i].data;
        for (let j = 0; j < temp.length; j++) {
            if (temp[j].content.length > 0) {
                totalResults[i].data.push(temp[j])
            }
        }
    }

    return totalResults
}