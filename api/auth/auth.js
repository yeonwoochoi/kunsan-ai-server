const express = require('express');
const router = express.Router();
const controller = require('./auth.controller');

router.post('/login', controller.login);
router.post('/isLogin', controller.isLogin);
router.post('/isAdmin', controller.isAdmin);
router.post('/check', controller.check);
router.post('/emailAuth', controller.emailAuth);
router.post('/emailCheck', controller.emailCheck);

module.exports = router;