function validateEnvironment() {
  if (!process.env.MONGO_URI?.trim()) {
    throw new Error('MONGO_URI must be configured');
  }

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.startsWith('replace_with')) {
    throw new Error('JWT_SECRET must be a non-placeholder secret of at least 32 characters');
  }

  const configuredOrigins = process.env.CLIENT_URL?.split(',').map(origin => origin.trim()).filter(Boolean) ?? [];
  if (process.env.NODE_ENV === 'production' && configuredOrigins.length === 0) {
    throw new Error('CLIENT_URL must contain at least one allowed frontend origin in production');
  }

  for (const origin of configuredOrigins) {
    let parsedOrigin;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error('CLIENT_URL must contain valid frontend origins');
    }
    if (!['http:', 'https:'].includes(parsedOrigin.protocol)
      || parsedOrigin.username
      || parsedOrigin.password
      || parsedOrigin.pathname !== '/'
      || parsedOrigin.search
      || parsedOrigin.hash
      || (process.env.NODE_ENV === 'production' && parsedOrigin.protocol !== 'https:')) {
      throw new Error('CLIENT_URL entries must be origins only (HTTPS in production)');
    }
  }

  const port = process.env.PORT;
  if (port !== undefined && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy !== undefined && !/^\d+$/.test(trustProxy)) {
    throw new Error('TRUST_PROXY must be a non-negative number of trusted proxy hops');
  }
}

module.exports = { validateEnvironment };
