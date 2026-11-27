const axios = require('axios');

const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const GEO_URL = 'https://api.openweathermap.org/geo/1.0';
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const POSTAL_URL = 'https://api.postalpincode.in/pincode';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();
const aliases = new Map([
  ['vizag', 'Visakhapatnam, Andhra Pradesh, IN'],
  ['visakhapatnam', 'Visakhapatnam, Andhra Pradesh, IN'],
  ['paderu', 'Paderu, Andhra Pradesh, IN'],
  ['chintapalli', 'Chintapalli, Andhra Pradesh, IN'],
  ['araku valley', 'Araku Valley, Andhra Pradesh, IN'],
  ['anakapalle', 'Anakapalle, Andhra Pradesh, IN']
]);

function getOpenWeatherKey() {
  const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith('replace_with') || apiKey === 'your_openweathermap_api_key') {
    return null;
  }
  return apiKey;
}

function createError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getCountryName(countryCode) {
  if (!countryCode) return undefined;
  return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) || countryCode;
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function coordinatesAreValid(location) {
  return Number.isFinite(Number(location.lat))
    && Number.isFinite(Number(location.lon))
    && Number(location.lat) >= -90
    && Number(location.lat) <= 90
    && Number(location.lon) >= -180
    && Number(location.lon) <= 180;
}

async function resolveCity(city) {
  const query = aliases.get(city.toLowerCase()) || city;
  const apiKey = getOpenWeatherKey();
  let results;
  try {
    if (apiKey) {
      const response = await axios.get(`${GEO_URL}/direct`, {
        params: { q: query, limit: 5, appid: apiKey },
        timeout: 8000
      });
      results = response.data;
    } else {
      const response = await axios.get(OPEN_METEO_GEOCODING_URL, {
        params: { name: query, count: 5, language: 'en', format: 'json' },
        timeout: 8000
      });
      results = (response.data?.results || []).map(result => ({
        name: result.name,
        lat: result.latitude,
        lon: result.longitude,
        country: result.country_code?.toUpperCase(),
        state: result.admin1
      }));
    }
  } catch (error) {
    if (apiKey && error.response?.status === 401) {
      throw createError('OpenWeatherMap API key is invalid', 'WEATHER_API_KEY_INVALID');
    }
    throw createError('Location search is unavailable. Please try again.', 'LOCATION_PROVIDER_UNAVAILABLE');
  }

  if (!Array.isArray(results) || results.length === 0) {
    throw createError('Location not found. Check the spelling or add a state or country.', 'LOCATION_NOT_FOUND');
  }

  const exactName = city.split(',')[0].trim().toLowerCase();
  const exactMatches = results.filter(result => result.name?.toLowerCase() === exactName);
  const candidates = exactMatches.length ? exactMatches : results;
  if (candidates.length > 1) {
    const suggestions = candidates
      .map(result => [result.name, result.state, result.country].filter(Boolean).join(', '))
      .filter((name, index, list) => list.indexOf(name) === index);
    throw createError(
      `More than one location matches. Search with a state or country: ${suggestions.join(' / ')}`,
      'LOCATION_AMBIGUOUS'
    );
  }

  const result = candidates[0];
  const location = { lat: Number(result.lat), lon: Number(result.lon) };
  if (!coordinatesAreValid(location)) {
    throw createError('Location search returned invalid coordinates.', 'LOCATION_PROVIDER_UNAVAILABLE');
  }
  return {
    ...location,
    city: result.name,
    state: result.state,
    country: result.country
  };
}

function normalizePostcode(value) {
  return typeof value === 'string' ? value.replace(/\s/g, '') : '';
}

async function resolvePinCode(pinCode) {
  if (!/^[1-9]\d{5}$/.test(pinCode)) {
    throw createError('Enter a valid 6-digit Indian PIN code.', 'PIN_CODE_INVALID');
  }

  let postalData;
  try {
    const response = await axios.get(`${POSTAL_URL}/${pinCode}`, { timeout: 8000 });
    postalData = response.data?.[0];
  } catch (error) {
    throw createError('PIN code lookup is unavailable. Please try again.', 'LOCATION_PROVIDER_UNAVAILABLE');
  }

  const offices = postalData?.Status === 'Success' && Array.isArray(postalData.PostOffice)
    ? postalData.PostOffice
    : [];
  if (!offices.length) {
    throw createError('This Indian PIN code was not found.', 'LOCATION_NOT_FOUND');
  }

  let geocodingResults;
  try {
    const response = await axios.get(NOMINATIM_URL, {
      params: {
        postalcode: pinCode,
        country: 'India',
        format: 'jsonv2',
        addressdetails: 1,
        limit: 5
      },
      headers: { 'User-Agent': 'WeatherDashboard/1.0' },
      timeout: 8000
    });
    geocodingResults = response.data;
  } catch (error) {
    throw createError('PIN code location lookup is unavailable. Please try again.', 'LOCATION_PROVIDER_UNAVAILABLE');
  }

  const matches = (Array.isArray(geocodingResults) ? geocodingResults : []).filter(result =>
    result.address?.country_code?.toLowerCase() === 'in'
    && normalizePostcode(result.address?.postcode) === pinCode
    && Number.isFinite(Number(result.lat))
    && Number.isFinite(Number(result.lon))
  );
  const uniqueMatches = matches.filter((result, index) =>
    matches.findIndex(match =>
      Number(match.lat).toFixed(4) === Number(result.lat).toFixed(4)
      && Number(match.lon).toFixed(4) === Number(result.lon).toFixed(4)
    ) === index
  );
  if (uniqueMatches.length === 0) {
    throw createError('This PIN code could not be matched to a verified map location.', 'LOCATION_NOT_FOUND');
  }
  if (uniqueMatches.length > 1) {
    throw createError('This PIN code matches multiple map locations. Search for a nearby city instead.', 'LOCATION_AMBIGUOUS');
  }

  const result = uniqueMatches[0];
  const address = result.address;
  const office = offices[0];
  return {
    lat: Number(result.lat),
    lon: Number(result.lon),
    city: address.city || address.town || address.village || address.suburb || office.Name,
    district: office.District || address.state_district || address.county,
    state: office.State || address.state,
    country: 'IN',
    postcode: pinCode
  };
}

async function resolveLocation(location) {
  if (location.city !== undefined) {
    const city = location.city.trim();
    if (!city) throw createError('Provide a city or PIN code.', 'LOCATION_NOT_FOUND');
    if (/^\d+$/.test(city)) {
      const cacheKey = `resolved:${city}`;
      const cached = getCached(cacheKey);
      if (cached) return cached;
      const resolved = await resolvePinCode(city);
      setCached(cacheKey, resolved);
      return resolved;
    }
    const cacheKey = `resolved:${city.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    const resolved = await resolveCity(city);
    setCached(cacheKey, resolved);
    return resolved;
  }
  if (!coordinatesAreValid(location)) {
    throw createError('Invalid coordinates.', 'LOCATION_NOT_FOUND');
  }
  return { lat: Number(location.lat), lon: Number(location.lon) };
}

async function resolveCurrentLocation(location) {
  if (location.city) return location;

  const cacheKey = `reverse:${normalizeLocation(location)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const apiKey = getOpenWeatherKey();
  if (!apiKey) {
    try {
      const response = await axios.get(NOMINATIM_REVERSE_URL, {
        params: {
          lat: location.lat,
          lon: location.lon,
          format: 'jsonv2',
          addressdetails: 1
        },
        headers: { 'User-Agent': 'WeatherDashboard/1.0' },
        timeout: 8000
      });
      const address = response.data?.address;
      const city = address?.city
        || address?.town
        || address?.village
        || address?.municipality
        || address?.hamlet
        || address?.suburb;
      if (!city) {
        throw createError('Your current location could not be identified.', 'LOCATION_NOT_FOUND');
      }

      const resolved = {
        ...location,
        city,
        district: address.state_district || address.county,
        state: address.state,
        country: address.country_code?.toUpperCase()
      };
      setCached(cacheKey, resolved);
      return resolved;
    } catch (error) {
      if (error.code === 'LOCATION_NOT_FOUND') throw error;
      throw createError('Current location lookup is unavailable. Please try again.', 'LOCATION_PROVIDER_UNAVAILABLE');
    }
  }

  try {
    const response = await axios.get(`${GEO_URL}/reverse`, {
      params: {
        lat: location.lat,
        lon: location.lon,
        limit: 1,
        appid: apiKey
      },
      timeout: 8000
    });
    const result = Array.isArray(response.data) ? response.data[0] : null;
    if (!result?.name) {
      throw createError('Your current location could not be identified.', 'LOCATION_NOT_FOUND');
    }

    const resolved = {
      ...location,
      city: result.name,
      district: result.state_district,
      state: result.state,
      country: result.country
    };
    setCached(cacheKey, resolved);
    return resolved;
  } catch (error) {
    if (error.code === 'LOCATION_NOT_FOUND') throw error;
    if (error.response?.status === 401) {
      throw createError('OpenWeatherMap API key is invalid', 'WEATHER_API_KEY_INVALID');
    }
    throw createError('Current location lookup is unavailable. Please try again.', 'LOCATION_PROVIDER_UNAVAILABLE');
  }
}

function normalizeLocation(location) {
  return `coords:${Number(location.lat).toFixed(4)},${Number(location.lon).toFixed(4)}`;
}

async function request(endpoint, location) {
  try {
    const response = await axios.get(`${BASE_URL}/${endpoint}`, {
      params: {
        lat: location.lat,
        lon: location.lon,
        units: 'metric',
        appid: getOpenWeatherKey()
      },
      timeout: 8000
    });
    return response.data;
  } catch (error) {
    const upstreamStatus = error.response?.status;
    if (upstreamStatus === 401) {
      throw createError('OpenWeatherMap API key is invalid', 'WEATHER_API_KEY_INVALID');
    }
    if (upstreamStatus === 404) {
      throw createError('Weather data is not available for this location.', 'LOCATION_NOT_FOUND');
    }

    const networkError = createError('Weather provider is unavailable', 'WEATHER_PROVIDER_UNAVAILABLE');
    networkError.cause = error;
    throw networkError;
  }
}

async function requestOpenMeteo(endpoint, location) {
  const params = endpoint === 'current'
    ? {
      latitude: location.lat,
      longitude: location.lon,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,pressure_msl,wind_speed_10m,visibility',
      daily: 'sunrise,sunset',
      forecast_days: 1,
      timezone: 'auto',
      timeformat: 'unixtime',
      wind_speed_unit: 'kmh'
    }
    : {
      latitude: location.lat,
      longitude: location.lon,
      hourly: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,is_day',
      forecast_days: 7,
      timezone: 'auto',
      timeformat: 'unixtime',
      wind_speed_unit: 'kmh'
    };

  try {
    const response = await axios.get(OPEN_METEO_URL, { params, timeout: 10000 });
    return response.data;
  } catch (error) {
    const providerError = createError('Weather provider is unavailable. Please try again.', 'WEATHER_PROVIDER_UNAVAILABLE');
    providerError.cause = error;
    throw providerError;
  }
}

function describeWeatherCode(code) {
  const descriptions = {
    0: ['Clear', 'clear sky', '01'],
    1: ['Clear', 'mainly clear', '02'],
    2: ['Clouds', 'partly cloudy', '03'],
    3: ['Clouds', 'overcast', '04'],
    45: ['Fog', 'fog', '50'],
    48: ['Fog', 'depositing rime fog', '50'],
    51: ['Drizzle', 'light drizzle', '09'],
    53: ['Drizzle', 'moderate drizzle', '09'],
    55: ['Drizzle', 'dense drizzle', '09'],
    56: ['Drizzle', 'light freezing drizzle', '13'],
    57: ['Drizzle', 'dense freezing drizzle', '13'],
    61: ['Rain', 'slight rain', '10'],
    63: ['Rain', 'moderate rain', '10'],
    65: ['Rain', 'heavy rain', '10'],
    66: ['Rain', 'light freezing rain', '13'],
    67: ['Rain', 'heavy freezing rain', '13'],
    71: ['Snow', 'slight snowfall', '13'],
    73: ['Snow', 'moderate snowfall', '13'],
    75: ['Snow', 'heavy snowfall', '13'],
    77: ['Snow', 'snow grains', '13'],
    80: ['Rain', 'slight rain showers', '09'],
    81: ['Rain', 'moderate rain showers', '09'],
    82: ['Rain', 'violent rain showers', '09'],
    85: ['Snow', 'slight snow showers', '13'],
    86: ['Snow', 'heavy snow showers', '13'],
    95: ['Thunderstorm', 'thunderstorm', '11'],
    96: ['Thunderstorm', 'thunderstorm with slight hail', '11'],
    99: ['Thunderstorm', 'thunderstorm with heavy hail', '11']
  };
  const [condition, description, icon] = descriptions[code] || ['Clouds', 'weather conditions', '04'];
  return { condition, description, icon };
}

function mapOpenMeteoCurrent(data, location) {
  const current = data.current;
  const weather = describeWeatherCode(current.weather_code);
  return {
    city: location.city || `${Number(location.lat).toFixed(2)}, ${Number(location.lon).toFixed(2)}`,
    district: location.district,
    state: location.state,
    postcode: location.postcode,
    country: location.country,
    countryName: getCountryName(location.country),
    temp: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    humidity: current.relative_humidity_2m,
    pressure: current.pressure_msl,
    windSpeed: current.wind_speed_10m,
    visibility: current.visibility === undefined ? undefined : Number((current.visibility / 1000).toFixed(1)),
    condition: weather.condition,
    description: weather.description,
    icon: `${weather.icon}${current.is_day ? 'd' : 'n'}`,
    sunrise: data.daily?.sunrise?.[0],
    sunset: data.daily?.sunset?.[0],
    updatedAt: current.time,
    timezoneOffset: data.utc_offset_seconds || 0,
    coord: { lat: location.lat, lon: location.lon }
  };
}

function mapOpenMeteoForecast(data, location) {
  const hourly = data.hourly;
  const list = hourly.time.map((timestamp, index) => {
    const weather = describeWeatherCode(hourly.weather_code[index]);
    return {
      dt: new Date(timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19),
      timestamp,
      temp: hourly.temperature_2m[index],
      feelsLike: hourly.apparent_temperature[index],
      humidity: hourly.relative_humidity_2m[index],
      rainProbability: hourly.precipitation_probability[index] === null
        ? undefined
        : hourly.precipitation_probability[index] / 100,
      condition: weather.condition,
      description: weather.description,
      icon: `${weather.icon}${hourly.is_day[index] ? 'd' : 'n'}`
    };
  });

  return {
    city: location.city || `${Number(location.lat).toFixed(2)}, ${Number(location.lon).toFixed(2)}`,
    district: location.district,
    state: location.state,
    country: location.country,
    timezoneOffset: data.utc_offset_seconds || 0,
    list
  };
}

async function getCurrentWeather(input) {
  const location = await resolveCurrentLocation(await resolveLocation(input));
  const cacheKey = `current:${normalizeLocation(location)}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return {
      ...cached,
      city: location.city || cached.city,
      district: location.district,
      state: location.state,
      postcode: location.postcode,
      country: location.country || cached.country,
      countryName: getCountryName(location.country || cached.country),
      coord: { lat: location.lat, lon: location.lon }
    };
  }

  const result = getOpenWeatherKey()
    ? await request('weather', location).then(data => {
      const country = location.country || data.sys?.country;
      return {
        city: location.city || data.name,
        district: location.district,
        state: location.state,
        postcode: location.postcode,
        country,
        countryName: getCountryName(country),
        temp: data.main.temp,
        feelsLike: data.main.feels_like,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        windSpeed: Number((data.wind.speed * 3.6).toFixed(1)),
        visibility: data.visibility === undefined ? undefined : Number((data.visibility / 1000).toFixed(1)),
        condition: data.weather?.[0]?.main,
        description: data.weather?.[0]?.description,
        icon: data.weather?.[0]?.icon,
        sunrise: data.sys?.sunrise,
        sunset: data.sys?.sunset,
        updatedAt: data.dt,
        timezoneOffset: data.timezone || 0,
        coord: { lat: location.lat, lon: location.lon }
      };
    })
    : mapOpenMeteoCurrent(await requestOpenMeteo('current', location), location);

  setCached(cacheKey, result);
  return result;
}

async function getForecast(input) {
  const location = await resolveLocation(input);
  const cacheKey = `forecast:${normalizeLocation(location)}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return {
      ...cached,
      city: location.city || cached.city,
      district: location.district,
      state: location.state,
      country: location.country || cached.country
    };
  }

  const result = getOpenWeatherKey()
    ? await request('forecast', location).then(data => ({
      city: location.city || data.city.name,
      district: location.district,
      state: location.state,
      country: location.country || data.city.country,
      timezoneOffset: data.city.timezone || 0,
      list: data.list.map(item => ({
        dt: item.dt_txt,
        timestamp: item.dt,
        temp: item.main.temp,
        tempMin: item.main.temp_min,
        tempMax: item.main.temp_max,
        feelsLike: item.main.feels_like,
        humidity: item.main.humidity,
        rainProbability: item.pop,
        condition: item.weather?.[0]?.main,
        description: item.weather?.[0]?.description,
        icon: item.weather?.[0]?.icon
      }))
    }))
    : mapOpenMeteoForecast(await requestOpenMeteo('forecast', location), location);

  setCached(cacheKey, result);
  return result;
}

module.exports = { getCurrentWeather, getForecast };
