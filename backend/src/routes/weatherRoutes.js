const express = require('express');
const { currentWeather, forecast } = require('../controllers/weatherController');

const router = express.Router();

router.get('/current', currentWeather);
router.get('/forecast', forecast);

module.exports = router;
