const mysql = require('mysql');
const config = require('../../config');
const connection = mysql.createConnection(config.SQL);
let User = require('../../models/user/user');
const crypto = require('crypto');
const secret = config.KEY.secret;
const jwt_secret = config.KEY.jwt_secret;
const jwt = require('jsonwebtoken');

function getTokens() {
    const accessToken = jwt.sign({
            id: User.user_id,
            role: User.user_role
        },
        jwt_secret, {
            expiresIn: '1m',
            issuer: 'Beagle',
            subject: 'accessToken'
        })
    const refreshToken = jwt.sign({
            id: User.user_id,
            role: User.user_role
        },
        jwt_secret, {
            expiresIn: '1h',
            issuer: 'Beagle',
            subject: 'refreshToken'
        })

    return {
        'status': 200,
        'msg': 'get token success',
        'data': {
            'id': User.user_id,
            'role': User.user_role,
            'accessToken': accessToken,
            'refreshToken': refreshToken
        }
    }
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
                let result = getTokens();
                let status = result.status;
                res.status(status).json(result)
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
    const accessToken = req.headers['x-access-token'];
    const refreshToken = req.headers['x-refresh-token'];

    if (!accessToken && !refreshToken) {
        res.status(400).json({
            'status': 400,
            'msg': 'Token 없음'
        });
    }

    console.log(`access :${accessToken}`)
    console.log(`refresh :${refreshToken}`)

    const checkToken = new Promise((resolve, reject) => {
        jwt.verify(accessToken, jwt_secret, function (err, decoded) {
            if (err) {
                jwt.verify(refreshToken, jwt_secret, function (err, decoded) {
                    if (err) reject(err)
                    else {
                        let result = getTokens();
                        result.data.refreshToken = null;
                        result.msg = "Access token is reissued"
                        res.status(result.status).json(result);
                    }
                })
            } else{
                resolve(accessToken);
            }
        });
    });

    checkToken.then(
        token => {
            console.log(token);
            res.status(200).json({
                'status': 200,
                'msg': 'Access token is valid',
                'data': {
                    'id': User.user_id,
                    'role': User.user_role,
                    'accessToken': token,
                    'refreshToken': null,
                }
            });
        },
        err => {
            console.log(err)
            res.status(400).json({
                'status': 400,
                'msg': 'Both tokens are invalid'
            })
        }
    )
};