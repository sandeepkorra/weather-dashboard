const axios = require('axios');

jest.mock('axios');

const weatherService = require('../src/services/weatherService');

describe('weatherService', () => {
  beforeEach(() => {
    process.env.OPENWEATHER_API_KEY = 'test-weather-key';
    jest.clearAllMocks();
  });

  it('maps current weather data from OpenWeatherMap', async () => {
    axios.get.mockResolvedValueOnce({
      data: [{ name: 'London', lat: 51.5, lon: -0.12, country: 'GB' }]
    });
    axios.get.mockResolvedValueOnce({
      data: {
        name: 'London',
        sys: { country: 'GB', sunrise: 1710000000, sunset: 1710040000 },
        main: { temp: 15, feels_like: 14, humidity: 70, pressure: 1012 },
        wind: { speed: 3.1 },
        visibility: 10000,
        weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }],
        dt: 1710020000,
        timezone: 0,
        coord: { lat: 51.5, lon: -0.12 }
      }
    });

    await expect(weatherService.getCurrentWeather({ city: 'London' })).resolves.toMatchObject({
      city: 'London',
      country: 'GB',
      countryName: 'United Kingdom',
      temp: 15,
      feelsLike: 14,
      humidity: 70,
      windSpeed: 11.2,
      visibility: 10,
      condition: 'Clear',
      description: 'clear sky',
      icon: '01d',
      sunrise: 1710000000,
      sunset: 1710040000,
      updatedAt: 1710020000,
      timezoneOffset: 0
    });
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.openweathermap.org/geo/1.0/direct',
      expect.objectContaining({
        params: { q: 'London', limit: 5, appid: 'test-weather-key' }
      })
    );
    expect(axios.get).toHaveBeenLastCalledWith(
      'https://api.openweathermap.org/data/2.5/weather',
      expect.objectContaining({
        params: { lat: 51.5, lon: -0.12, units: 'metric', appid: 'test-weather-key' }
      })
    );
  });

  it('maps forecast data and caches repeated requests', async () => {
    axios.get.mockResolvedValueOnce({
      data: [{ name: 'Tokyo', lat: 35.68, lon: 139.69, country: 'JP' }]
    });
    axios.get.mockResolvedValueOnce({
      data: {
        city: { name: 'Tokyo', country: 'JP', timezone: 32400 },
        list: [{
          dt: 1790053200,
          dt_txt: '2026-09-22 12:00:00',
          main: { temp: 28, temp_min: 25, temp_max: 30, feels_like: 30, humidity: 55 },
          pop: 0.35,
          weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }]
        }]
      }
    });

    const first = await weatherService.getForecast({ city: 'Tokyo' });
    const second = await weatherService.getForecast({ city: 'Tokyo' });

    expect(first).toEqual(second);
    expect(first).toMatchObject({ timezoneOffset: 32400 });
    expect(first.list[0]).toMatchObject({
      timestamp: 1790053200,
      temp: 28,
      tempMin: 25,
      tempMax: 30,
      rainProbability: 0.35,
      condition: 'Clear',
      description: 'clear sky',
      icon: '01d'
    });
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('uses Open-Meteo for current weather and forecasts when no OpenWeatherMap key is configured', async () => {
    delete process.env.OPENWEATHER_API_KEY;
    axios.get
      .mockResolvedValueOnce({
        data: {
          results: [{
            name: 'Reykjavik',
            latitude: 64.1466,
            longitude: -21.9426,
            country_code: 'IS',
            country: 'Iceland',
            admin1: 'Capital Region'
          }]
        }
      })
      .mockResolvedValueOnce({
        data: {
          utc_offset_seconds: 0,
          current: {
            time: 1795759200,
            temperature_2m: 5,
            relative_humidity_2m: 80,
            apparent_temperature: 2,
            is_day: 1,
            weather_code: 3,
            pressure_msl: 1012,
            wind_speed_10m: 18,
            visibility: 10000
          },
          daily: { sunrise: [1795730000], sunset: [1795770000] }
        }
      })
      .mockResolvedValueOnce({
        data: {
          utc_offset_seconds: 0,
          hourly: {
            time: [1795759200],
            temperature_2m: [5],
            relative_humidity_2m: [80],
            apparent_temperature: [2],
            precipitation_probability: [35],
            weather_code: [3],
            is_day: [1]
          }
        }
      });

    await expect(weatherService.getCurrentWeather({ city: 'Reykjavik' })).resolves.toMatchObject({
      city: 'Reykjavik',
      country: 'IS',
      temp: 5,
      feelsLike: 2,
      humidity: 80,
      windSpeed: 18,
      visibility: 10,
      condition: 'Clouds',
      description: 'overcast',
      icon: '04d',
      sunrise: 1795730000,
      sunset: 1795770000
    });

    await expect(weatherService.getForecast({ city: 'Reykjavik' })).resolves.toMatchObject({
      city: 'Reykjavik',
      list: [{
        temp: 5,
        feelsLike: 2,
        humidity: 80,
        rainProbability: 0.35,
        condition: 'Clouds',
        icon: '04d'
      }]
    });

    expect(axios.get).toHaveBeenNthCalledWith(
      1,
      'https://geocoding-api.open-meteo.com/v1/search',
      expect.objectContaining({
        params: { name: 'Reykjavik', count: 5, language: 'en', format: 'json' }
      })
    );
    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      'https://api.open-meteo.com/v1/forecast',
      expect.objectContaining({
        params: expect.objectContaining({
          latitude: 64.1466,
          longitude: -21.9426,
          current: expect.any(String),
          timeformat: 'unixtime'
        })
      })
    );
  });

  it('rejects an invalid provider key', async () => {
    axios.get.mockRejectedValueOnce({ response: { status: 401 } });

    await expect(weatherService.getCurrentWeather({ city: 'Paris' })).rejects.toMatchObject({
      code: 'WEATHER_API_KEY_INVALID'
    });
  });

  it('rejects malformed PIN codes before calling location providers', async () => {
    await expect(weatherService.getCurrentWeather({ city: '01234' })).rejects.toMatchObject({
      code: 'PIN_CODE_INVALID'
    });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('resolves a valid Indian PIN code before requesting weather', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: [{ Status: 'Success', PostOffice: [{ Name: 'Waltair', District: 'Visakhapatnam', State: 'Andhra Pradesh' }] }]
      })
      .mockResolvedValueOnce({
        data: [{
          lat: '17.72',
          lon: '83.30',
          address: {
            postcode: '530001',
            country_code: 'in',
            suburb: 'Waltair',
            state_district: 'Visakhapatnam',
            state: 'Andhra Pradesh'
          }
        }]
      })
      .mockResolvedValueOnce({
        data: {
          name: 'Visakhapatnam',
          sys: { country: 'IN' },
          main: { temp: 29, feels_like: 31, humidity: 70, pressure: 1012 },
          wind: { speed: 3.1 },
          visibility: 10000,
          weather: [{ description: 'clear sky', icon: '01d' }],
          coord: { lat: 17.72, lon: 83.3 }
        }
      });

    await expect(weatherService.getCurrentWeather({ city: '530001' })).resolves.toMatchObject({
      city: 'Waltair',
      district: 'Visakhapatnam',
      state: 'Andhra Pradesh',
      postcode: '530001',
      country: 'IN',
      coord: { lat: 17.72, lon: 83.3 }
    });
    expect(axios.get).toHaveBeenLastCalledWith(
      'https://api.openweathermap.org/data/2.5/weather',
      expect.objectContaining({
        params: { lat: 17.72, lon: 83.3, units: 'metric', appid: 'test-weather-key' }
      })
    );
  });

  it('does not use a postal lookup whose map result has a different PIN code', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: [{ Status: 'Success', PostOffice: [{ Name: 'Waltair', District: 'Visakhapatnam', State: 'Andhra Pradesh' }] }]
      })
      .mockResolvedValueOnce({
        data: [{
          lat: '17.72',
          lon: '83.30',
          address: { postcode: '530003', country_code: 'in' }
        }]
      });

    await expect(weatherService.getCurrentWeather({ city: '530002' })).rejects.toMatchObject({
      code: 'LOCATION_NOT_FOUND'
    });
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('reports ambiguous city results instead of selecting the first match', async () => {
    axios.get.mockResolvedValueOnce({
      data: [
        { name: 'Springfield', lat: 39.8, lon: -89.6, country: 'US', state: 'Illinois' },
        { name: 'Springfield', lat: 42.1, lon: -72.6, country: 'US', state: 'Massachusetts' }
      ]
    });

    await expect(weatherService.getCurrentWeather({ city: 'Springfield' })).rejects.toMatchObject({
      code: 'LOCATION_AMBIGUOUS'
    });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('resolves Vizag to Visakhapatnam before fetching weather', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: [{ name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.69, lon: 83.22, country: 'IN' }]
      })
      .mockResolvedValueOnce({
        data: {
          name: 'Visakhapatnam',
          sys: { country: 'IN' },
          main: { temp: 29, feels_like: 31, humidity: 70, pressure: 1012 },
          wind: { speed: 3.1 },
          visibility: 10000,
          weather: [{ description: 'clear sky', icon: '01d' }],
          coord: { lat: 17.69, lon: 83.22 }
        }
      });

    await expect(weatherService.getCurrentWeather({ city: 'Vizag' })).resolves.toMatchObject({
      city: 'Visakhapatnam',
      state: 'Andhra Pradesh',
      country: 'IN'
    });
    expect(axios.get).toHaveBeenNthCalledWith(
      1,
      'https://api.openweathermap.org/geo/1.0/direct',
      expect.objectContaining({
        params: { q: 'Visakhapatnam, Andhra Pradesh, IN', limit: 5, appid: 'test-weather-key' }
      })
    );
  });

  it('reverse-geocodes current coordinates and requests weather at the exact coordinates', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: [{ name: 'Chintapalli', state: 'Andhra Pradesh', country: 'IN' }]
      })
      .mockResolvedValueOnce({
        data: {
          name: 'Nearby place',
          sys: { country: 'IN' },
          main: { temp: 24, feels_like: 25, humidity: 80, pressure: 1012 },
          wind: { speed: 2 },
          visibility: 9000,
          weather: [{ description: 'cloudy', icon: '03d' }],
          coord: { lat: 17.68, lon: 82.99 }
        }
      });

    await expect(weatherService.getCurrentWeather({ lat: 17.6789, lon: 82.9876 })).resolves.toMatchObject({
      city: 'Chintapalli',
      state: 'Andhra Pradesh',
      country: 'IN',
      coord: { lat: 17.6789, lon: 82.9876 }
    });
    expect(axios.get).toHaveBeenNthCalledWith(
      1,
      'https://api.openweathermap.org/geo/1.0/reverse',
      expect.objectContaining({
        params: { lat: 17.6789, lon: 82.9876, limit: 1, appid: 'test-weather-key' }
      })
    );
    expect(axios.get).toHaveBeenLastCalledWith(
      'https://api.openweathermap.org/data/2.5/weather',
      expect.objectContaining({
        params: { lat: 17.6789, lon: 82.9876, units: 'metric', appid: 'test-weather-key' }
      })
    );
  });
});
