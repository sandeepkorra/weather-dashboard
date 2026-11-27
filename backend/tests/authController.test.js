jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../src/models/User');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const { register } = require('../src/controllers/authController');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
}

describe('authController', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-with-more-than-32-characters';
    jest.clearAllMocks();
  });

  it('hashes the password and returns a signed token without the hash', async () => {
    const user = {
      _id: { toString: () => 'user-id' },
      name: 'Weather User',
      email: 'user@example.com',
      passwordHash: 'stored-hash'
    };
    User.findOne.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('stored-hash');
    User.create.mockResolvedValue(user);
    jwt.sign.mockReturnValue('signed-token');
    const req = {
      body: { name: ' Weather User ', email: ' USER@example.com ', password: 'strong-password' }
    };
    const res = createResponse();

    await register(req, res, jest.fn());

    expect(bcrypt.hash).toHaveBeenCalledWith('strong-password', 12);
    expect(User.create).toHaveBeenCalledWith({
      name: 'Weather User',
      email: 'user@example.com',
      passwordHash: 'stored-hash'
    });
    expect(jwt.sign).toHaveBeenCalledWith(
      { userId: 'user-id' },
      process.env.JWT_SECRET,
      expect.objectContaining({ algorithm: 'HS256', expiresIn: '7d' })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      token: 'signed-token',
      user: { id: user._id, name: user.name, email: user.email }
    });
  });

  it('rejects malformed registration data before querying MongoDB', async () => {
    const req = {
      body: { name: 'Weather User', email: 'not-an-email', password: 'strong-password' }
    };
    const res = createResponse();

    await register(req, res, jest.fn());

    expect(User.findOne).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'A valid email address is required' });
  });

  it('rejects passwords that exceed bcrypt input capacity', async () => {
    const req = {
      body: { name: 'Weather User', email: 'user@example.com', password: 'a'.repeat(73) }
    };
    const res = createResponse();

    await register(req, res, jest.fn());

    expect(User.findOne).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
