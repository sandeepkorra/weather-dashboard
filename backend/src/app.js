const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const weatherRoutes = require('./routes/weatherRoutes');

const app = express();
if (process.env.TRUST_PROXY !== undefined) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY));
}

const configuredOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(origin => origin.trim()).filter(Boolean)
  : [];
const allowedOrigins = configuredOrigins.length
  ? configuredOrigins.map(origin => new URL(origin).origin)
  : process.env.NODE_ENV === 'production' ? [] : ['http://localhost:4200'];

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please try again later.' }
});

const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      imgSrc: ["'self'", 'data:', 'https://openweathermap.org']
    }
  }
};
if (process.env.NODE_ENV !== 'production') helmetOptions.hsts = false;

app.use(helmet(helmetOptions));
app.use(cors({ origin: allowedOrigins }));
app.use('/api', apiLimiter);
app.use(express.json({ limit: '16kb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/weather', weatherRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/favorites', favoriteRoutes);

if (process.env.NODE_ENV === 'production') {
  const angularDistPath = path.resolve(
    __dirname,
    process.env.ANGULAR_DIST_PATH || '../../frontend/dist/frontend/browser'
  );

  app.use(express.static(angularDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(angularDistPath, 'index.html'));
  });
}

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON request body' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large' });
  }

  const status = error.status || error.statusCode || 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({
    message: status < 500 ? error.message : 'Internal server error'
  });
});

module.exports = app;
