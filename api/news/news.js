const express = require('express');
const router = express.Router();
const {upload} = require("../../config/file")
const controller = require('./news.controller');

router.post('/register', upload.array("files"), controller.create)
router.post('/readByPage', controller.getNewsContentInPage)
router.get('/read/:idx', controller.readByIndex)
router.get('/addViewCount/:idx', controller.addViewCount)
router.post('/getTotalPage', controller.getTotalPage)
router.post('/delete', controller.delete)
router.post('/update', upload.array("files"), controller.update)

module.exports = router;