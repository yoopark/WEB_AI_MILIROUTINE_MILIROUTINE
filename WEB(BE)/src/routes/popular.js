const express = require("express");
const router = express.Router();
const ctrl = require('../controllers/popular.ctrl');


router.get('/', ctrl.routine.outputPopular);

module.exports = router;