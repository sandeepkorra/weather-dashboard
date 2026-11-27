jest.mock('../src/models/FavoriteCity');
jest.mock('../src/models/SearchHistory');

const SearchHistory = require('../src/models/SearchHistory');
const { addSearchHistory, clearHistory } = require('../src/controllers/favoriteController');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis()
  };
}

describe('addSearchHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores the authenticated user and normalized city details', async () => {
    const entry = { _id: 'history-id', city: 'London' };
    SearchHistory.create.mockResolvedValue(entry);
    const req = {
      userId: 'user-id',
      body: { city: '  London  ', country: 'GB', latitude: 51.5, longitude: -0.12 }
    };
    const res = createResponse();
    const next = jest.fn();

    await addSearchHistory(req, res, next);

    expect(SearchHistory.create).toHaveBeenCalledWith({
      user: 'user-id',
      city: 'London',
      country: 'GB',
      latitude: 51.5,
      longitude: -0.12
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(entry);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid coordinates without writing to MongoDB', async () => {
    const req = { userId: 'user-id', body: { city: 'London', latitude: 91, longitude: 0 } };
    const res = createResponse();

    await addSearchHistory(req, res, jest.fn());

    expect(SearchHistory.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'latitude and longitude are invalid' });
  });

  it('clears only the authenticated user search history', async () => {
    SearchHistory.deleteMany.mockResolvedValue({ deletedCount: 2 });
    const req = { userId: 'user-id' };
    const res = createResponse();
    const next = jest.fn();

    await clearHistory(req, res, next);

    expect(SearchHistory.deleteMany).toHaveBeenCalledWith({ user: 'user-id' });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
