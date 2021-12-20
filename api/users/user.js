const express = require('express');
const router = express.Router();
const controller = require('./user.controller');

router.get('/', controller.showAll);
router.post('/register', controller.register);
router.post('/logout', controller.logout);
router.post('/resetTempPwd', controller.resetTempPwd);
router.post('/resetPwd', controller.resetPwd);



module.exports = router;