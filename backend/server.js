require('dotenv').config();

require('./src/config/env').validateEnvironment();

const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
if (!apiKey || apiKey.startsWith('replace_with') || apiKey === 'your_openweathermap_api_key') {
  console.info('OPENWEATHER_API_KEY is not configured; using the no-key Open-Meteo weather provider.');
}

const app = require('./src/app');
const connectDB = require('./src/config/db');

const port = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Weather API listening on port ${port}`);
    });
  })
  .catch(error => {
    console.error(`Startup failed: ${error.message}`);
    process.exit(1);
  });
