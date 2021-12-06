const express = require('express');
const router = express.Router();
const {upload} = require("../../config/file")
const controller = require('./board.controller');

router.post('/register', upload.array("files"), controller.create)
router.post('/readByPage', controller.getBoardContentInPage)
router.get('/read/:idx', controller.readByIndex)
router.get('/addViewCount/:idx', controller.addViewCount)
router.post('/getTotalPage', controller.getTotalPage)
router.post('/addComment', controller.addComment)
router.post('/checkAuthor', controller.checkAuthor)
router.post('/delete', controller.delete)
router.post('/update', upload.array("files"), controller.update)

module.exports = router;