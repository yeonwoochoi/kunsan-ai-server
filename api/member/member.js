const express = require('express');
const router = express.Router();
const {upload} = require("../../config/file")
const controller = require('./member.controller');

router.post('/register', upload.single("file"), controller.registerMember)
router.post('/update', upload.single("file"), controller.updateMember)
router.get('/readAll', controller.readAllMembers)
router.get('/read/:idx', controller.readMemberByIdx)
router.post('/delete', controller.deleteMemberByIdx)

module.exports = router;