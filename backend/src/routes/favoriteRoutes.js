const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  listFavorites,
  addFavorite,
  removeFavorite,
  listHistory,
  addSearchHistory,
  clearHistory
} = require('../controllers/favoriteController');

const router = express.Router();

router.use(authMiddleware);
router.get('/', listFavorites);
router.post('/', addFavorite);
router.delete('/history', clearHistory);
router.delete('/:id', removeFavorite);
router.get('/history', listHistory);
router.post('/history', addSearchHistory);

module.exports = router;
