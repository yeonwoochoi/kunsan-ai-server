const express = require('express');
const router = express.Router();
const {upload} = require("../../config/file")
const controller = require('./news.controller');

router.post('/register', upload.array("files"), controller.create)
router.post('/readByPage', controller.getNewsContentInPage)
router.get('/read/:idx', controller.read)
router.get('/addViewCount/:idx', controller.addViewCount)
router.post('/getTotalPage', controller.getTotalPage)
router.post('/update', controller.update)

module.exports = router;