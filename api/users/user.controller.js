const mysql = require('mysql');
const config = require('../../config/config');
const connection = mysql.createConnection(config.SQL);
let User = require('../../models/user/user');
const crypto = require('crypto');
const jwt = require("jsonwebtoken");
const secret = config.KEY.secret;
const jwt_secret = config.KEY.jwt_secret;


exports.showAll = (req, res) => {
    connection.query(`SELECT * from user`, function (error, results, fields) {
        if (error) {
            console.log(error);
            return res.status(400).json({
                error: error
            })
        }
        return res.json(results);
    });
};

exports.register = (req, res) => {
    console.log('register called')
    const hash = crypto.createHmac('sha256', secret)
        .update(req.body.pwd)
        .digest('base64');
    User.user_id = req.body.id;
    User.user_pwd = hash;
    User.user_name = req.body.name;
    User.user_phone = req.body.phone;
    User.user_organization = req.body.organization;
    User.user_role = 'user';

    console.log(`id: ${User.user_id}\n pwd: ${User.user_pwd}\n name: ${User.user_name}\n phone: ${User.user_phone}\n organization: ${User.user_organization}`)

    // 유저 등록
    if (User.user_id && User.user_pwd && User.user_role && User.user_phone && User.user_organization && User.user_name) {
        connection.query(`SELECT user_id FROM user WHERE user_id = "${User.user_id}"`, function (error, check_result, fields) {
            if (check_result.length === 0) {
                connection.query(`INSERT INTO user (user_id, user_pwd, user_name, user_phone, user_organization, user_role) VALUES ("${User.user_id }", "${User.user_pwd}", "${User.user_name}", "${User.user_phone}", "${User.user_organization}", "${User.user_role}")`,
                    function (error, results, fields) {
                        if (error) {
                            console.log(`error : ${error}`);
                            return res.status(400).json({
                                error: error
                            })
                        }
                        const getToken = new Promise((resolve, reject) => {
                            jwt.sign({
                                    id: User.user_id,
                                    role: User.user_role
                                },
                                jwt_secret, {
                                    expiresIn: '1m',
                                    issuer: 'Beagle',
                                    subject: 'accessToken'
                                }, (err, accessToken) => {
                                    if (err) reject(err)
                                    jwt.sign({
                                            id: User.user_id,
                                            role: User.user_role
                                        },
                                        jwt_secret, {
                                            expiresIn: '1h',
                                            issuer: 'Beagle',
                                            subject: 'refreshToken'
                                        }, (err, refreshToken) => {
                                            if (err) reject(err)
                                            let tokens = {
                                                accessToken: accessToken,
                                                refreshToken: refreshToken
                                            }
                                            resolve(tokens)
                                        })
                                })
                        });

                        getToken.then(
                            (tokens) => {
                                console.log(`user : ${User.user_id}`)
                                console.log(`refresh : ${tokens.refreshToken}`)
                                connection.query(`UPDATE user SET user_token = "${tokens.refreshToken}" WHERE user_id = "${User.user_id}"`, function (error, results) {
                                    if (error) {
                                        console.log('refresh token 을 db에 저장중 error 발생 (register)')
                                        res.status(400).json({
                                            'status': 400,
                                            'msg': 'register failure'
                                        })
                                    }
                                    res.status(200).json({
                                        'status': 200,
                                        'msg': 'register success',
                                        'data': {
                                            'id': User.user_id,
                                            'role': User.user_role,
                                            'accessToken': tokens.accessToken,
                                        }
                                    });
                                })
                            },
                            err => {
                                console.log(err)
                                res.status(400).json({
                                    'status': 400,
                                    'msg': 'register failure'
                                })
                            }
                        );
                    });
            } else {
                res.status(400).json({
                    'status': 400,
                    'msg': '중복 ID'
                });
            }
        });
    } else {
        res.status(400).json({
            'status': 400,
            'msg': '값을 다 채워주세요'
        });
    }
};


exports.logout = (req, res) => {
    // Refresh token 삭제
    const id = req.body.id;
    connection.query(`UPDATE user SET user_token = null WHERE user_id = "${id}"`, function (error, results, fields) {
        if (error) {
            console.log(error);
            res.status(400).json({
                'status': 400,
                'msg': 'Delete refresh token failed'
            });
        }
        console.log(`Delete refresh token success : ${results}`)
        res.status(200).json({
            'status': 200,
            'msg': 'logout success'
        });
    });
};