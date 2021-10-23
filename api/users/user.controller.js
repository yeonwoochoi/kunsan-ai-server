const mysql = require('mysql');
const config = require('../../config/config');
const connection = mysql.createConnection(config.SQL);
let User = require('../../models/user/user');
const crypto = require('crypto');
const jwt = require("jsonwebtoken");
const secret = config.KEY.secret;
const jwt_secret = config.KEY.jwt_secret;
const query = require('../../config/query')


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
        const checkUserQuery = query.selectQuery('user', ['user_id'], {'user_id': User.user_id});
        connection.query(checkUserQuery, function (error, check_result, fields) {
            if (check_result.length === 0) {
                let registerQuery = query.insertQuery('user', {
                    'user_id': User.user_id,
                    'user_pwd': User.user_pwd,
                    'user_name': User.user_name,
                    'user_phone': User.user_phone,
                    'user_organization': User.user_organization,
                    'user_role': User.user_role
                })
                connection.query(registerQuery, function (error, results, fields) {
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
                            const updateTokenQuery = query.updateQuery('user', {'user_token': tokens.refreshToken}, {'user_id': User.user_id})
                            connection.query(updateTokenQuery, function (error, results) {
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


exports.resetPwd = (req, res) => {
    const {email} = req.body;
    const temp_pwd = randomPwdGenerator();
    const selectQuery = query.selectQuery('user', ['user_id'], {'user_id': email})
    connection.query(selectQuery, function (error, check_result, fields) {
        if (error) {
            res.status(400).json({
                'status': 400,
                'msg': 'email auth for reset password failure'
            })
        }
        if (check_result.length === 0) {
            res.status(400).json({
                'status': 400,
                'msg': '가입되지 않은 이메일입니다.'
            });
        } else {
            const hash = crypto.createHmac('sha256', secret)
                .update(temp_pwd)
                .digest('base64');
            const updatePwdQuery = query.updateQuery('user', {'user_pwd': hash}, {'user_id': email});
            connection.query(updatePwdQuery, function (error, results, fields) {
                if (error) {
                    console.log(`error occurred during reset password : ${error}`);
                    res.status(400).json({
                        'status': 400,
                        'msg': 'Reset password failed'
                    })
                }
                console.log(`Reset password success : ${results}`)
                res.status(200).json({
                    'status': 200,
                    'msg': 'Reset password success',
                    'data': {
                        'pwd': temp_pwd
                    }
                })
            })
        }
    })
}


exports.logout = (req, res) => {
    // Refresh token 삭제
    const id = req.body.id;
    const removeTokenQuery = query.updateQuery('user', {'user_token': null}, {'user_id': id})
    connection.query(removeTokenQuery, function (error, results, fields) {
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

const randomPwdGenerator = () => {
    return Math.random().toString(36).substr(2,11);
}