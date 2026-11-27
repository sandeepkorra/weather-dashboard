# Deployment

## MongoDB Atlas

1. Create an Atlas cluster and a dedicated database user.
2. Create a database named `weather_dashboard` through the connection string.
3. Add the backend host's outbound IP addresses to Network Access. Use `0.0.0.0/0` only temporarily when the host uses dynamic outbound IPs.
4. Copy the SRV connection string into `MONGO_URI`; URL-encode special characters in the database password.

Required backend environment variables:

```text
NODE_ENV=production
PORT=10000
MONGO_URI=mongodb+srv://...
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters
CLIENT_URL=https://your-frontend.example
ANGULAR_DIST_PATH=../../frontend/dist/frontend/browser
```

`CLIENT_URL` accepts a comma-separated allowlist of frontend origins (origins only, no paths); production origins must use HTTPS. The backend refuses to start without `MONGO_URI` and a random `JWT_SECRET` of at least 32 characters. Weather works without a key through Open-Meteo. Set the optional `OPENWEATHER_API_KEY` on the backend to use OpenWeatherMap instead. Keep `.env` out of source control; the frontend must never contain the OpenWeather key.

The API has Helmet security headers, a 300-request/15-minute API limit, and a stricter 10-request/15-minute authentication limit per IP. The default limiter store is in-memory; use a shared store when running multiple backend instances.
If deployed behind a trusted reverse proxy, set `TRUST_PROXY` to the exact number of proxy hops so rate limits use the client IP; do not enable it for direct public access.

Location search uses Open-Meteo geocoding when no OpenWeatherMap key is configured, plus the Indian Postal PIN lookup API and OpenStreetMap Nominatim to verify postal-code coordinates. Browser geolocation requires the deployed frontend to use HTTPS (localhost is also supported).

## Split deployment: Render backend and Vercel/Netlify frontend

Backend:

```bash
cd backend
npm ci
npm start
```

Configure the backend service's start command as `npm start` and set all production environment variables in the host dashboard. Use the assigned public backend URL for the frontend API URL.

Frontend:

```bash
cd frontend
npm ci
npm run build -- --configuration production
```

Set `frontend/src/environments/environment.prod.ts` to the deployed backend URL, then deploy the generated `dist/frontend/browser` directory. On Vercel or Netlify, configure the Angular build command and publish directory in the project settings.

## Single-service deployment

Build the Angular app first, then start Express from the workspace root:

```bash
cd frontend
npm ci
npm run build -- --configuration production
cd ../backend
npm ci
NODE_ENV=production npm start
```

With `NODE_ENV=production`, Express serves `frontend/dist/frontend/browser` and falls back to its `index.html` for client-side routes. Set `ANGULAR_DIST_PATH` if the Angular project name or output path differs.

## Production checks

- Never commit `.env` or API keys.
- Confirm `CLIENT_URL` exactly matches the frontend origin.
- Enable HTTPS on both services.
- Use a long random `JWT_SECRET`.
- Confirm `GET /api/health` after deployment.
- Add rate limiting and structured logging before exposing the service publicly.
- Recent searches are saved and displayed only for authenticated users; favorite and search-history endpoints require a bearer token.
