const http = require('http');

const originalClientUrl = process.env.CLIENT_URL;
process.env.CLIENT_URL = 'http://localhost:4200';
const app = require('../src/app');
if (originalClientUrl === undefined) delete process.env.CLIENT_URL;
else process.env.CLIENT_URL = originalClientUrl;

let server;
let port;

function sendRequest(path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8')
      }));
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  port = server.address().port;
});

afterAll(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

describe('security middleware', () => {
  it('sets Helmet headers and only grants CORS to configured origins', async () => {
    const allowed = await sendRequest('/api/health', {
      headers: { Origin: 'http://localhost:4200' }
    });
    const denied = await sendRequest('/api/health', {
      headers: { Origin: 'https://untrusted.example' }
    });

    expect(allowed.status).toBe(200);
    expect(allowed.headers['x-content-type-options']).toBe('nosniff');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    expect(allowed.headers['content-security-policy']).toContain('https://openweathermap.org');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns client errors for malformed and oversized JSON bodies', async () => {
    const malformed = await sendRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{'
    });
    const oversized = await sendRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'x'.repeat(17 * 1024) })
    });

    expect(malformed.status).toBe(400);
    expect(JSON.parse(malformed.body)).toEqual({ message: 'Malformed JSON request body' });
    expect(oversized.status).toBe(413);
    expect(JSON.parse(oversized.body)).toEqual({ message: 'Request body is too large' });
  });

  it('limits authentication requests', async () => {
    const responses = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      responses.push(await sendRequest('/api/auth/login', { method: 'POST' }));
    }

    expect(responses.slice(0, 10).every(response => response.status === 400)).toBe(true);
    expect(responses[10].status).toBe(429);
  });
});
