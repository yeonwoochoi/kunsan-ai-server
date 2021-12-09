const mysql = require('mysql');
const config = require('../../config/config');
const connection = mysql.createConnection(config.SQL);
const crypto = require('crypto');
const jwt = require("jsonwebtoken");
const secret = config.KEY.secret;
const jwt_secret = config.KEY.jwt_secret;
const query = require('../../config/query')
const ApiError = require("../error/api-error");
const utils = require("../../util/utils");
const {checkAdmin} = require("../auth/auth.controller");


exports.create = (req, res, next) => {

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
        next(ApiError.badRequest('Please input all data'))
    }
}

exports.update = (req, res, next) => {

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