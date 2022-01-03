const express = require('express');
const router = express.Router();
const {upload} = require("../../config/file")
const controller = require('./lecture.controller');

router.post('/register', controller.createLecture)
router.post('/register/board', upload.array("files"), controller.createBoard)
router.post('/readByPage', controller.getLectureContentInPage)
router.get('/read/board/:idx', controller.readBoardContentByIndex)
router.get('/addViewCount/:idx', controller.addViewCount)
router.post('/read', controller.readLecture)
router.post('/getTotalPage', controller.getTotalPage)
router.post('/addComment', controller.addComment)
router.post('/delete', controller.delete)
router.post('/delete/board', controller.deleteBoard)
router.post('/delete/comment', controller.deleteComment)
router.post('/update/board', upload.array("files"), controller.updateBoard)
router.post('/update', controller.update)
router.get('/readAll', controller.getLectureList)
router.post('/checkAdmin', controller.isAdmin)
router.post('/checkCommentAuthor', controller.checkCommentAuthor)

module.exports = router;