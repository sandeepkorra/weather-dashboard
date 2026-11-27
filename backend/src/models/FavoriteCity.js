const mongoose = require('mongoose');

const favoriteCitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  city: { type: String, required: true, trim: true },
  country: { type: String, trim: true },
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 }
}, { timestamps: true });

favoriteCitySchema.index({ user: 1, city: 1 }, { unique: true });

module.exports = mongoose.model('FavoriteCity', favoriteCitySchema);
