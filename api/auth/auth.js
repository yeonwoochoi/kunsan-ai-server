const express = require('express');
const router = express.Router();
const controller = require('./auth.controller');

router.post('/login', controller.login);
router.post('/check', controller.check);
router.post('/emailAuth', controller.emailAuth);
router.post('/emailCheck', controller.emailCheck);

module.exports = router;