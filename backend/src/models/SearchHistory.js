const mongoose = require('mongoose');

const searchHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  city: { type: String, required: true, trim: true },
  country: { type: String, trim: true },
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 }
}, { timestamps: true });

searchHistorySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('SearchHistory', searchHistorySchema);
