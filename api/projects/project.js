const express = require('express');
const router = express.Router();
const controller = require('./project.controller');
const {upload} = require("../../config/file")


router.get('/read/:idx', controller.readProjectByIdx)
router.get('/readAll', controller.readProjectAll)
router.post('/register', upload.single("file"), controller.registerProject)

module.exports = router;