const mysql = require('mysql');
const config = require('../../config');
const connection = mysql.createConnection(config.SQL);
let User = require('../../models/user/user');
const crypto = require('crypto');
const secret = config.KEY.secret;
const jwt_secret = config.KEY.jwt_secret;
const jwt = require('jsonwebtoken');



exports.login = (req, res) => {
    // 로그인 인증
    User.user_id = req.body.id;
    User.user_pwd = req.body.pwd;
    console.log(req.body.id)
    console.log(req.body.pwd)
    if (User.user_id) {
        connection.query(`SELECT user_pwd, user_role FROM user WHERE user_id = "${User.user_id}"`, function (error, results) {
            if (error) {
                console.log(error)
                res.status(400).json({
                    'status': 400,
                    'msg': 'login failure'
                })
            }
            console.log(results);

            const hash = crypto.createHmac('sha256', secret)
                .update(req.body.pwd)
                .digest('base64');

            User.user_role = results[0].user_role;

            if (hash === results[0].user_pwd) {
                const getToken = new Promise((resolve, reject) => {
                    jwt.sign({
                            id: User.user_id,
                            role: User.user_role
                        },
                        jwt_secret, {
                            expiresIn: '1m',
                            issuer: 'Beagle',
                            subject: 'userInfo'
                        }, (err, token) => {
                            if (err) reject(err)
                            resolve(token)
                        })
                });

                getToken.then(
                    token => {
                        res.status(200).json({
                            'status': 200,
                            'msg': 'login success',
                            'data': {
                                'id': User.user_id,
                                'role': User.user_role,
                                'token': token
                            }
                        });
                    },
                    err => {
                        console.log(err)
                        res.status(400).json({
                            'status': 400,
                            'msg': 'login failure'
                        })
                    }
                );
            } else {
                res.status(400).json({
                    'status': 400,
                    'msg': 'password 가 틀림'
                });
            }
        });
    } else {
        res.status(400).json({
            'status': 400,
            'msg': 'id값이 없음'
        });
    }
};

exports.check = (req, res) => {
    // 인증 확인
    const token = req.headers['x-access-token'] || req.headers['x-refresh-token'];

    if (!token) {
        res.status(400).json({
            'status': 400,
            'msg': 'Token 없음'
        });
    }
    const checkToken = new Promise((resolve, reject) => {
        jwt.verify(token, jwt_secret, function (err, decoded) {
            if (err) reject(err);
            resolve(token);
        });
    });

    checkToken.then(
        token => {
            console.log(token);
            res.status(200).json({
                'status': 200,
                'msg': 'success',
                'data': {
                    'id': User.user_id,
                    'role': User.user_role,
                    'token': token
                }
            });
        },
        err => {
            console.log(err)
            res.status(400).json({
                'status': 400,
                'msg': 'Invalid Token'
            })
        }
    )
};