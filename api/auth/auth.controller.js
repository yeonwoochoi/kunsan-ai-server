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

function getAccessToken (user_id, user_role) {
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

function getRefreshToken(res, next) {
    let refreshToken = null;
    console.log(User.user_id)
    const selectTokenQuery = query.selectQuery('user', ['user_token'], {'user_id': User.user_id})
    connection.query(selectTokenQuery, function (error, results) {
        if (error) {
            console.log('Get refresh token from db failed')
            next(ApiError.badRequest('Get refresh token from db failed'))
            return;
        }

        if (results.length > 0) {
            refreshToken = results[0].user_token;
            const checkRefreshToken = new Promise(((resolve, reject) => {
                jwt.verify(refreshToken, jwt_secret, function (err, decoded) {
                    if (err) reject(err)
                    else {
                        resolve(refreshToken)
                    }
                })
            }))
            checkRefreshToken.then(
                (refreshToken) => {
                    console.log('Refresh token is valid')
                    getAccessToken(User.user_id, User.user_role).then(
                        (accessToken)=>{
                            res.status(200).json({
                                'status': 200,
                                'msg': 'Reissuing the access token',
                                'data': {
                                    'id': User.user_id,
                                    'role': User.user_role,
                                    'accessToken': accessToken,
                                }
                            });
                        },
                        (err) => {
                            console.log(`Error occurred while reissuing the access token: ${err}`)
                            next(ApiError.badRequest(`Error occurred while reissuing the access token.`))
                        }
                    )
                },
                (err) => {
                    console.log(`Refresh token is invalid`)
                    next(ApiError.badRequest(`Both token is invalid. Please login again.`))
                }
            )
        }
        else {
            console.log(`Access token is invalid and Refresh token is null`)
            next(ApiError.badRequest(`Access token is invalid and Refresh token is null. Please login again`))
        }
    });
}

let generateRandom = (min, max) => {
    let randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
    return randomNum;
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
    User.user_id = req.body.id;
    User.user_pwd = req.body.pwd;

    if (User.user_id) {
        const selectQuery = query.selectQuery('user', ['user_pwd', 'user_role'], {'user_id': User.user_id});
        connection.query(selectQuery, function (error, results) {
            if (error) {
                console.log(error)
                next(ApiError.badRequest('There is a problem with the server. Please try again in a few minutes.'));
                return;
            }
            if (results.length > 0) {
                console.log(results);

                const hash = crypto.createHmac('sha256', secret)
                    .update(req.body.pwd)
                    .digest('base64');

                User.user_role = results[0].user_role;

                if (hash === results[0].user_pwd) {
                    getAccessToken(User.user_id, User.user_role).then(
                        (accessToken) => {
                            setRefreshToken(User.user_id, User.user_role).then(
                                (refreshToken) => {
                                    res.status(200).json({
                                        'status': 200,
                                        'msg': 'Login success',
                                        'data': {
                                            'id': User.user_id,
                                            'role': User.user_role,
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
    User.user_id = req.body.id;
    User.user_role = 'user';
    let accessToken = req.headers['x-access-token'];
    let refreshToken = null;
    if (accessToken) {
        const checkToken = new Promise((resolve, reject) => {
            jwt.verify(accessToken, jwt_secret, function (err, decoded) {
                if (err) {
                    reject(err)
                } else{
                    resolve(accessToken);
                }
            });
        });
        checkToken.then(
            token => {
                res.status(200).json({
                    'status': 200,
                    'msg': 'Access token is still valid',
                    'data': {
                        'id': User.user_id,
                        'role': User.user_role,
                        'accessToken': token,
                    }
                });
            },
            err => {
                console.log(`Access token is invalid: ${err}`)
                getRefreshToken(res, next)
            }
        )
    } else {
        getRefreshToken(res, next)
    }
};

