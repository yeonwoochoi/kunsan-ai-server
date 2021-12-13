const express = require('express');
const router = express.Router();
const {upload} = require("../../config/file")
const controller = require('./professor.controller');

router.post('/register', upload.single("file"), controller.registerProfessor)
router.post('/update', upload.single("file"), controller.updateProfessor)
router.get('/readAll', controller.readAllProfessor)
router.get('/read/:idx', controller.readProfessorByIdx)
router.post('/delete', controller.deleteProfessorByIdx)

module.exports = router;