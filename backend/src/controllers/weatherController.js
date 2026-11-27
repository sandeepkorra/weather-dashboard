const weatherService = require('../services/weatherService');

function parseLocation(query) {
  if (query.city !== undefined && typeof query.city !== 'string') {
    const error = new Error('city must be a single text value');
    error.status = 400;
    throw error;
  }
  const city = typeof query.city === 'string' ? query.city.trim() : '';
  const hasCoordinates = query.lat !== undefined || query.lon !== undefined;
  if (city.length > 120) {
    const error = new Error('city must not exceed 120 characters');
    error.status = 400;
    throw error;
  }

  if (city && hasCoordinates) {
    const error = new Error('Provide either a city or coordinates, not both');
    error.status = 400;
    throw error;
  }
  if (city) return { city };
  if (!hasCoordinates && !city) {
    const error = new Error('Provide a city or both lat and lon query parameters');
    error.status = 400;
    throw error;
  }
  if (query.lat === undefined || query.lon === undefined) {
    const error = new Error('Both lat and lon query parameters are required');
    error.status = 400;
    throw error;
  }
  if (typeof query.lat !== 'string' || typeof query.lon !== 'string' || !query.lat.trim() || !query.lon.trim()) {
    const error = new Error('lat and lon must be numeric values');
    error.status = 400;
    throw error;
  }

  const lat = Number(query.lat);
  const lon = Number(query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    const error = new Error('lat must be between -90 and 90 and lon must be between -180 and 180');
    error.status = 400;
    throw error;
  }

  return { lat, lon };
}

function sendWeatherError(error, next, res) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  if (error.code === 'PIN_CODE_INVALID') return res.status(400).json({ message: error.message });
  if (error.code === 'LOCATION_NOT_FOUND') return res.status(404).json({ message: error.message });
  if (error.code === 'LOCATION_AMBIGUOUS') return res.status(409).json({ message: error.message });
  if (error.code === 'WEATHER_API_KEY_INVALID') return res.status(502).json({ message: error.message });
  if (error.code === 'LOCATION_PROVIDER_UNAVAILABLE') return res.status(503).json({ message: error.message });
  if (error.code === 'WEATHER_PROVIDER_UNAVAILABLE') return res.status(503).json({ message: error.message });
  return next(error);
}

async function currentWeather(req, res, next) {
  try {
    const location = parseLocation(req.query);
    const data = await weatherService.getCurrentWeather(location);
    return res.json(data);
  } catch (error) {
    return sendWeatherError(error, next, res);
  }
}

async function forecast(req, res, next) {
  try {
    const location = parseLocation(req.query);
    const data = await weatherService.getForecast(location);
    return res.json(data);
  } catch (error) {
    return sendWeatherError(error, next, res);
  }
}

module.exports = { currentWeather, forecast };
