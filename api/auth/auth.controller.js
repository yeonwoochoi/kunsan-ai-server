const mysql = require('mysql');
const config = require('../../config/config');
const connection = mysql.createConnection(config.SQL);
let User = require('../../models/user/user');
const crypto = require('crypto');
const secret = config.KEY.secret;
const jwt_secret = config.KEY.jwt_secret;
const jwt = require('jsonwebtoken');
const {transporter} = require("../../config/email");

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
              connection.query(`UPDATE user SET user_token = '${refreshToken}' WHERE user_id = '${user_id}'`, function (error, results) {
                  if (error) {
                      reject(error)
                  }
                  resolve(refreshToken)
              })
          }
      )
    })
}

function getRefreshToken(res) {
    let refreshToken = null;
    console.log(User.user_id)
    connection.query(`select user_token from user where user_id = "${User.user_id}"`, function (error, results) {
        if (error) {
            console.log('Get refresh token from db failed')
            res.status(400).json({
                'status': 400,
                'msg': 'Access Token is invalid and cannot get refresh token'
            })
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
                            res.status(400).json({
                                'status': 400,
                                'msg': `Error occurred while reissuing the access token.`
                            })
                        }
                    )
                },
                (err) => {
                    console.log(`Refresh token is invalid`)
                    res.status(400).json({
                        'status': 400,
                        'msg': `Both token is invalid. Please login again.`
                    })
                }
            )
        }
        else {
            console.log(`Access token is invalid and Refresh token is null`)
            res.status(400).json({
                'status': 400,
                'msg': `Access token is invalid and Refresh token is null. Please login again`
            })
        }
    });
}

let generateRandom = (min, max) => {
    let randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
    return randomNum;
}

exports.emailAuth = async (req, res) => {
    const number = generateRandom(111111, 999999);
    const {email} = req.body;
    const mailOptions = {
        from: 'chldusdn20@gmail.com',
        to: email,
        subject: "[Vada]인증 관련 이메일 입니다.",
        text: `<p>Vada 사이트로 돌아가 아래 인증번호 6자리를 입력해주세요</p>\n<h3>${number}</h3>`
    }
    connection.query(`SELECT user_id FROM user WHERE user_id = "${email}"`, async function (error, check_result, fields) {
        if (error) {
            res.status(400).json({
                'status': 400,
                'msg': 'email auth failure'
            })
        }
        if (check_result.length > 0) {
            res.status(400).json({
                'status': 400,
                'msg': '이미 가입된 Email 입니다.'
            });
        } else {
            const result = await transporter.sendMail(mailOptions, (error, response) => {
                if (error) {
                    console.log(`Error occurred while sending member registration verification email : ${error}`)
                    res.status(400).json({
                        'status': 400,
                        'msg': 'email auth failure'
                    })
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

exports.login = (req, res) => {
    // 로그인 인증
    User.user_id = req.body.id;
    User.user_pwd = req.body.pwd;
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
                getAccessToken(User.user_id, User.user_role).then(
                    (accessToken) => {
                        setRefreshToken(User.user_id, User.user_role).then(
                            (refreshToken) => {
                                res.status(200).json({
                                    'status': 200,
                                    'msg': 'login success',
                                    'data': {
                                        'id': User.user_id,
                                        'role': User.user_role,
                                        'accessToken': accessToken,
                                    }
                                });
                            },
                            (err) => {
                                console.log(err)
                                res.status(400).json({
                                    'status': 400,
                                    'msg': 'login failure during setting refresh token'
                                })
                            }
                        )
                    },
                    (err) => {
                        console.log(err)
                        res.status(400).json({
                            'status': 400,
                            'msg': 'login failure'
                        })
                    }
                )
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
                getRefreshToken(res)
            }
        )
    } else {
        getRefreshToken(res)
    }
};

