const express = require('express');
const router = express.Router();
const controller = require('./publication.controller');

router.post('/create', controller.create);
router.post('/delete', controller.delete);
router.post('/update', controller.update);
router.get('/readAll', controller.readAll);
router.get('/read/:idx', controller.read);



module.exports = router;