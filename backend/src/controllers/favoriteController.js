const FavoriteCity = require('../models/FavoriteCity');
const SearchHistory = require('../models/SearchHistory');
const mongoose = require('mongoose');

function validateCoordinates(latitude, longitude) {
  if (latitude === undefined && longitude === undefined) return true;
  return typeof latitude === 'number'
    && typeof longitude === 'number'
    && Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function validatePlaceBody(body, res) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ message: 'A JSON object is required' });
    return false;
  }
  if (typeof body.city !== 'string' || !body.city.trim() || body.city.trim().length > 120) {
    res.status(400).json({ message: 'city must be between 1 and 120 characters' });
    return false;
  }
  if (body.country !== undefined && (typeof body.country !== 'string' || body.country.trim().length > 80)) {
    res.status(400).json({ message: 'country must be text no longer than 80 characters' });
    return false;
  }
  if (!validateCoordinates(body.latitude, body.longitude)) {
    res.status(400).json({ message: 'latitude and longitude are invalid' });
    return false;
  }
  return true;
}

async function listFavorites(req, res, next) {
  try {
    const favorites = await FavoriteCity.find({ user: req.userId }).sort({ createdAt: -1 });
    return res.json(favorites);
  } catch (error) {
    return next(error);
  }
}

async function addFavorite(req, res, next) {
  try {
    if (!validatePlaceBody(req.body, res)) return;
    const { city, country, latitude, longitude } = req.body;

    const favorite = await FavoriteCity.create({
      user: req.userId,
      city: city.trim(),
      country,
      latitude,
      longitude
    });
    return res.status(201).json(favorite);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'City is already favorited' });
    return next(error);
  }
}

async function removeFavorite(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Favorite id is invalid' });
    }
    const removed = await FavoriteCity.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!removed) return res.status(404).json({ message: 'Favorite city not found' });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function listHistory(req, res, next) {
  try {
    const history = await SearchHistory.find({ user: req.userId }).sort({ createdAt: -1 }).limit(10);
    return res.json(history);
  } catch (error) {
    return next(error);
  }
}

async function addSearchHistory(req, res, next) {
  try {
    if (!validatePlaceBody(req.body, res)) return;
    const { city, country, latitude, longitude } = req.body;

    const entry = await SearchHistory.create({
      user: req.userId,
      city: city.trim(),
      country,
      latitude,
      longitude
    });
    return res.status(201).json(entry);
  } catch (error) {
    return next(error);
  }
}

async function clearHistory(req, res, next) {
  try {
    await SearchHistory.deleteMany({ user: req.userId });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = { listFavorites, addFavorite, removeFavorite, listHistory, addSearchHistory, clearHistory };
