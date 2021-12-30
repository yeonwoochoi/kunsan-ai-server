const express = require('express');
const router = express.Router();
const {upload} = require("../../config/file")
const controller = require('./lecture.controller');

router.post('/register', controller.createLecture)
router.post('/register/board', upload.array("files"), controller.createBoard)
router.post('/readByPage', controller.getLectureContentInPage)
router.get('/read/:idx', controller.readByIndex)
router.get('/addViewCount/:idx', controller.addViewCount)
router.post('/getTotalPage', controller.getTotalPage)
router.post('/addComment', controller.addComment)
router.post('/delete', controller.delete)
router.post('/delete/board', controller.deleteBoard)
router.post('/delete/comment', controller.deleteComment)
router.post('/update', upload.array("files"), controller.update)
router.get('/readAll', controller.getLectureList)
router.post('/checkAdmin', controller.isAdmin)
router.post('/checkCommentAuthor', controller.checkCommentAuthor)

module.exports = router;