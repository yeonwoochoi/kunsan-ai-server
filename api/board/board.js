const express = require('express');
const router = express.Router();
const {upload} = require("../../config/file")
const controller = require('./board.controller');

router.post('/register', upload.array("files"), controller.create)
router.get('/readAll', controller.readAll)

module.exports = router;