const mysql = require('mysql');
const config = require('../../config/config');
const connection = mysql.createConnection(config.SQL);
const ApiError = require('../error/api-error');
const query = require('../../config/query');
const address = require('../../config/address').IP;

exports.registerProject = (req, res, next) => {
    const {title, content, from, to, sponsor} = req.body;
    const file = req.file;
    if (title.length > 0 && content.length > 0) {
        const insertQuery = query.insertQuery('project', {
            project_title: title,
            project_content: content,
            project_image_link: file.filename,
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
            if (results.affectedRows > 0 || results.changedRows > 0) {
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