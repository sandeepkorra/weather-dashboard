const { validateEnvironment } = require('../src/config/env');

const variableNames = [
  'NODE_ENV',
  'MONGO_URI',
  'JWT_SECRET',
  'OPENWEATHER_API_KEY',
  'CLIENT_URL',
  'PORT',
  'TRUST_PROXY'
];
let originalValues;

beforeEach(() => {
  originalValues = Object.fromEntries(variableNames.map(name => [name, process.env[name]]));
  variableNames.forEach(name => delete process.env[name]);
  process.env.NODE_ENV = 'development';
  process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/weather_dashboard_test';
  process.env.JWT_SECRET = 'local-development-secret-with-32-characters';
});

afterEach(() => {
  variableNames.forEach(name => delete process.env[name]);
  Object.entries(originalValues).forEach(([name, value]) => {
    if (value !== undefined) process.env[name] = value;
  });
});

describe('validateEnvironment', () => {
  it('allows local development without a weather provider key', () => {
    expect(() => validateEnvironment()).not.toThrow();
  });

  it('allows production without an OpenWeatherMap key', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://weather.example';

    expect(() => validateEnvironment()).not.toThrow();
  });
});
