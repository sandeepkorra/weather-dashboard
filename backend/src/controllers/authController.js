const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_BYTES = 72;

function issueToken(userId) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    const error = new Error('JWT secret must be configured with at least 32 characters');
    error.status = 500;
    throw error;
  }
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}

async function register(req, res, next) {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ message: 'A JSON object is required' });
    }
    const { name, email, password } = body;
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedName || normalizedName.length > 80) {
      return res.status(400).json({ message: 'name must be between 1 and 80 characters' });
    }
    if (normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ message: 'A valid email address is required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'password must be at least 8 characters' });
    }
    if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
      return res.status(400).json({ message: 'password must not exceed 72 UTF-8 bytes' });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ message: 'Email is already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name: normalizedName, email: normalizedEmail, passwordHash });
    return res.status(201).json({ token: issueToken(user._id.toString()), user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Email is already registered' });
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ message: 'A JSON object is required' });
    }
    const { email, password } = body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ message: 'A valid email address is required' });
    }
    if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
      return res.status(400).json({ message: 'password must not exceed 72 UTF-8 bytes' });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    return res.json({ token: issueToken(user._id.toString()), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login };
