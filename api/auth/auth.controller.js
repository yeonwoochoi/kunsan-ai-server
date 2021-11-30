const mysql = require('mysql');
const config = require('../../config/config');
const connection = mysql.createConnection(config.SQL);
let User = require('../../models/user/user');
const crypto = require('crypto');
const secret = config.KEY.secret;
const jwt_secret = config.KEY.jwt_secret;
const jwt = require('jsonwebtoken');
const {transporter} = require("../../config/email");
const query = require("../../config/query");
const ApiError = require("../error/api-error");
const utils = require("../../util/utils");


function createAccessToken (user_id, user_role) {
    return new Promise((resolve, reject) => {
        jwt.sign(
            {
                id: user_id,
                role: user_role
            },
            jwt_secret,
            {
                expiresIn: '1m',
                issuer: 'Beagle',
                subject: 'accessToken'
            },
            (err, accessToken) => {
                if (err) reject(err)
                resolve(accessToken)
            }
        )
    })
}

function setRefreshToken(user_id, user_role) {
    return new Promise((resolve, reject) => {
      jwt.sign(
          {
              id: user_id,
              role: user_role
          },
          jwt_secret,
          {
              expiresIn: '1h',
              issuer: 'Beagle',
              subject: 'refreshToken'
          },
          (err, refreshToken) => {
              if (err) reject(err)
              const updateRefreshTokenQuery = query.updateQuery('user', {'user_token': refreshToken}, {'user_id': user_id});
              connection.query(updateRefreshTokenQuery, function (error, results) {
                  if (error) {
                      reject(error)
                  }
                  resolve(refreshToken)
              })
          }
      )
    })
}

function getRefreshToken(user_id) {
    let refreshToken = null;
    let user_role = null;
    const selectTokenQuery = query.selectQuery('user', ['user_token', 'user_role'], {'user_id': user_id})
    return new Promise((resolve, reject) => {
        connection.query(selectTokenQuery, function (error, results) {
            if (error) {
                console.log('Get refresh token from db failed')
                reject({
                    'status': 400,
                    'msg': 'Get refresh token from db failed'
                })
            }
            else if (results.length > 0) {
                refreshToken = results[0].user_token;
                user_role = results[0].user_role;
                const checkToken = new Promise(((resolve, reject) => {
                    jwt.verify(refreshToken, jwt_secret, function (err, decoded) {
                        if (err) {
                            reject(err)
                        }
                        else {
                            resolve(refreshToken)
                        }
                    })
                }))
                checkToken.then(
                    (refreshToken) => {
                        console.log('Refresh token is valid')
                        createAccessToken(user_id, user_role).then(
                            (accessToken) => {
                                resolve({
                                    'status': 200,
                                    'msg': 'Reissuing the access token',
                                    'data': {
                                        'id': user_id,
                                        'role': user_role,
                                        'accessToken': accessToken,
                                    }
                                })
                            },
                            (err) => {
                                console.log(`Error occurred while reissuing the access token: ${err}`)
                                reject({
                                    'status': 400,
                                    'msg': `Error occurred while reissuing the access token.`,
                                })
                            }
                        )
                    },
                    (err) => {
                        console.log(`Refresh token is invalid`)
                        reject({
                            'status': 400,
                            'msg': `Both token is invalid. Please login again.`,
                        })
                    }
                )
            }
            else {
                console.log(`Access token is invalid and Refresh token is null`)
                reject({
                    'status': 400,
                    'msg': `Access token is invalid and Refresh token is null. Please login again`,
                })
            }
        });
    });
}

let generateRandom = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

exports.emailAuth = async (req, res, next) => {
    const number = generateRandom(111111, 999999);
    const {email} = req.body;
    let email_form = require('../../views/email-form.js').form;
    const email_form_new = email_form.replace("$authNum", number)
    const mailOptions = {
        from: 'chldusdn20@gmail.com',
        to: email,
        subject: "[Vada]인증 관련 이메일 입니다.",
        html: email_form_new
    }
    const selectQuery = query.selectQuery('user', ['user_id'], {'user_id': email});
    connection.query(selectQuery, async function (error, check_result, fields) {
        if (error) {
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            return;
        }
        if (check_result.length > 0) {
            next(ApiError.badRequest('Email is already registered'));
        } else {
            const result = await transporter.sendMail(mailOptions, (error, response) => {
                if (error) {
                    console.log(`Error occurred while sending member registration verification email for sign up : ${error}`)
                    next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                } else {
                    res.status(200).json({
                        'status': 200,
                        'msg': 'Successfully sending verification code by e-mail',
                        'data': {
                            'id': User.user_id,
                            'role': User.user_role,
                            'authNum': number,
                        }
                    })
                }
                transporter.close();
            })
        }
    })
}

exports.emailCheck = async (req, res, next) => {
    const number = generateRandom(111111, 999999);
    const {email} = req.body;
    let email_form = require('../../views/email-form.js').form;
    const email_form_new = email_form.replace("$authNum", number)
    const mailOptions = {
        from: 'chldusdn20@gmail.com',
        to: email,
        subject: "[Vada]인증 관련 이메일 입니다.",
        html: email_form_new
    }
    const selectQuery = query.selectQuery('user', ['user_id'], {'user_id': email});
    connection.query(selectQuery, async function (error, check_result, fields) {
        if (error) {
            next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
            return;
        }
        if (check_result.length === 0) {
            next(ApiError.badRequest('Email is not registered'));
        } else {
            const result = await transporter.sendMail(mailOptions, (error, response) => {
                if (error) {
                    console.log(`Error occurred while sending member registration verification email for reset pwd : ${error}`)
                    next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                } else {
                    res.status(200).json({
                        'status': 200,
                        'msg': 'Successfully sending verification code by e-mail',
                        'data': {
                            'id': User.user_id,
                            'role': User.user_role,
                            'authNum': number,
                        }
                    })
                }
                transporter.close();
            })
        }
    })
}

exports.login = (req, res, next) => {
    // 로그인 인증
    const user_id = req.body.id;
    const user_pwd = req.body.pwd;
    let user_role = null;

    if (user_id) {
        const selectQuery = query.selectQuery('user', ['user_pwd', 'user_role'], {'user_id': user_id});
        connection.query(selectQuery, function (error, results) {
            if (error) {
                console.log(error)
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                return;
            }
            if (results.length > 0) {
                console.log(results);

                const hash = crypto.createHmac('sha256', secret)
                    .update(user_pwd)
                    .digest('base64');

                user_role = results[0].user_role;

                if (hash === results[0].user_pwd) {
                    createAccessToken(user_id, user_role).then(
                        (accessToken) => {
                            setRefreshToken(user_id, user_role).then(
                                (refreshToken) => {
                                    res.status(200).json({
                                        'status': 200,
                                        'msg': 'Login success',
                                        'data': {
                                            'id': user_id,
                                            'role': user_role,
                                            'accessToken': accessToken,
                                        }
                                    });
                                },
                                (err) => {
                                    console.log('Login failure during setting refresh token');
                                    next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                                }
                            )
                        },
                        (err) => {
                            console.log(err)
                            next(ApiError.badRequest('Login failure'));
                        }
                    )
                } else {
                    next(ApiError.badRequest('Wrong password'));
                }
            } else {
                console.log('Email is not registered');
                next(ApiError.badRequest('Email is not registered'));
            }
        });
    } else {
        next(ApiError.badRequest('Please input email'));
    }
};

exports.check = (req, res, next) => {
    // 인증 확인
    const user_id = req.body.id;
    let accessToken = req.headers['x-access-token'];
    let refreshToken = null;
    if (accessToken) {
        const checkToken = new Promise((resolve, reject) => {
            jwt.verify(accessToken, jwt_secret, function (err, decoded) {
                if (err) {
                    reject('Access token is invalid')
                } else{
                    resolve(accessToken);
                }
            });
        });
        checkToken.then(
            token => {
                console.log('Access token is valid')
                let payload = utils.parseJwt(token)
                if (payload.id === user_id) {
                    res.status(200).json({
                        'status': 200,
                        'msg': 'Access token is valid',
                        'data': {
                            'id': user_id,
                            'role': payload.role,
                            'accessToken': token,
                        }
                    })
                } else {
                    next(ApiError.badRequest('Invalid access. Please logout and try again.'));
                }
            },
            err => {
                console.log(err)
                getRefreshToken(user_id).then(
                    (result) => {
                        res.status(200).json(result);
                    },
                    (error) => {
                        next(ApiError.badRequest(err));
                    }
                )
            }
        )
    } else {
        getRefreshToken(user_id).then(
            (result) => {
                res.status(200).json(result);
            },
            (error) => {
                next(ApiError.badRequest(error.msg));
            }
        )
    }
};

