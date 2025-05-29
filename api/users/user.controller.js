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
const {checkTempUser} = require('../../api/auth/auth.controller')


exports.showAll = (req, res, next) => {
    connection.query(`SELECT * from user`, function (error, results, fields) {
        if (error) {
            console.log('show all users failure');
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            return;
        }
        return res.status(200).json(results);
    });
};


exports.register = (req, res, next) => {
    const {id, name, phone, organization} = req.body;
    const hash = crypto.createHmac('sha256', secret)
        .update(req.body.pwd)
        .digest('base64');
    const role = 'user';

    // 유저 등록
    if (id && hash && role && phone && organization && name) {
        const checkUserQuery = query.selectQuery('user', ['user_id'], {'user_id': id});
        connection.query(checkUserQuery, function (error, check_result, fields) {
            if (check_result.length === 0) {
                let registerQuery = query.insertQuery('user', {
                    'user_id': id,
                    'user_pwd': hash,
                    'user_name': name,
                    'user_phone': phone,
                    'user_organization': organization,
                    'user_role': role
                })
                connection.query(registerQuery, function (error, results, fields) {
                    if (error) {
                        console.log('Register failure during input user data into db');
                        next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                        return;
                    }
                    const getToken = new Promise((resolve, reject) => {
                        jwt.sign({
                                id: id,
                                role: role
                            },
                            jwt_secret, {
                                expiresIn: '1m',
                                issuer: 'Beagle',
                                subject: 'accessToken'
                            }, (err, accessToken) => {
                                if (err) reject(err)
                                jwt.sign({
                                        id: id,
                                        role: role
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
                            const updateTokenQuery = query.updateQuery('user', {'user_token': tokens.refreshToken}, {'user_id': id})
                            connection.query(updateTokenQuery, function (error, results) {
                                if (error) {
                                    console.log('refresh token 을 db에 저장중 error 발생 (register)')
                                    next(ApiError.badRequest('Register failure'));
                                }
                                res.status(200).json({
                                    'status': 200,
                                    'msg': 'Register success',
                                    'data': {
                                        'id': id,
                                        'role': role,
                                        'accessToken': tokens.accessToken,
                                    }
                                });
                            })
                        },
                        err => {
                            console.log(err)
                            next(ApiError.badRequest('Register failure'));
                        }
                    );
                });
            } else {
                next(ApiError.badRequest('Email is already registered'));
            }
        });
    } else {
        next(ApiError.badRequest('Please fill in all the values'));
    }
};


exports.resetTempPwd = (req, res, next) => {
    const {email} = req.body;
    const temp_pwd = randomPwdGenerator();
    //const temp_pwd = '123123123';
    const selectQuery = query.selectQuery('user', ['user_id'], {'user_id': email})
    connection.query(selectQuery, function (error, check_result, fields) {
        if (error) {
            console.log('Email auth for reset password failure')
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            return;
        }
        if (check_result.length === 0) {
            console.log('Email is not registered')
            next(ApiError.badRequest('Email is not registered'));
        } else {
            const hash = crypto.createHmac('sha256', secret)
                .update(temp_pwd)
                .digest('base64');
            const updatePwdQuery = query.updateQuery('user', {'user_pwd': hash, 'user_reset': 1}, {'user_id': email});
            connection.query(updatePwdQuery, function (error, results, fields) {
                if (error) {
                    console.log(`Error occurred during update temp password : ${error}`);
                    next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                    return;
                }
                console.log(`Reset temp password success : ${results}`)
                res.status(200).json({
                    'status': 200,
                    'msg': 'Reset temp password success',
                    'data': {
                        'pwd': temp_pwd
                    }
                })
            })
        }
    })
}

exports.resetPwd = (req, res, next) => {
    const {email, newPwd} = req.body;
    const hash = crypto.createHmac('sha256', secret)
        .update(newPwd)
        .digest('base64');
    checkTempUser(email).then(
        isTempUser => {
            if (isTempUser) {
                const updatePwdQuery = query.updateQuery('user', {'user_pwd': hash, 'user_reset': 0}, {'user_id': email});
                connection.query(updatePwdQuery, function (error, results) {
                    if (error) {
                        console.log(`Error occurred during update new password : ${error}`);
                        next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                        return;
                    }
                    if (results.affectedRows > 0) {
                        console.log(`Reset password success : ${results}`)
                        res.status(200).json({
                            'status': 200,
                            'msg': 'Reset password success',
                            'data': {
                                'pwd': newPwd
                            }
                        })
                    }
                    else {
                        console.log('Reset password failed')
                        next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                    }
                })
            }
            else {
                console.log('This user does not have a temporary password.')
                next(ApiError.badRequest('Invalid access. Please logout and try again.'));
            }
        },
        err => {
            if (err.status === 500) {
                next(ApiError.internal(err.msg))
            }
            else {
                next(ApiError.unauthorized(err.msg))
            }
        }
    )
}

exports.logout = (req, res, next) => {
    // Refresh token 삭제
    const id = req.body.id;
    const removeTokenQuery = query.updateQuery('user', {'user_token': null}, {'user_id': id})
    connection.query(removeTokenQuery, function (error, results, fields) {
        if (error) {
            console.log(error);
            next(ApiError.badRequest('Logout failure'));
            return;
        }
        console.log(`Delete refresh token success : ${results}`)
        res.status(200).json({
            'status': 200,
            'msg': 'Logout success'
        });
    });
};


const randomPwdGenerator = () => {
    return Math.random().toString(36).substr(2,11);
}