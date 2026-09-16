# Scalable URL Shortener

A system-design-oriented URL shortener built with Node.js, Express, PostgreSQL and Redis.

## Architecture

```text
Client
  |
  v
React Frontend
  |
  v
Node.js + Express API
  |
  +---- Redis cache
  |
  +---- PostgreSQL
```

## Features

- Create short URLs
- Base62 short-code generation
- Redirect short URLs
- Redis cache for fast redirects
- PostgreSQL persistence
- Health check endpoint
- Environment-based configuration
- Docker Compose for local PostgreSQL and Redis

## Local setup

1. Install Node.js and Docker Desktop.
2. Install backend dependencies:

```bash
npm install
```

3. Start PostgreSQL and Redis:

```bash
docker compose up -d
```

4. Copy `.env.example` to `.env`.
5. Start the API:

```bash
npm start
```

The API runs on `http://localhost:3000` by default.

## API

### Create short URL

`POST /shorten`

Body:

```json
{
  "originalUrl": "https://www.google.com"
}
```

### Redirect

`GET /:shortCode`

### Health

`GET /health`

## Production deployment

For an internet-facing deployment, host PostgreSQL and Redis as managed services, then deploy the Node.js API with the corresponding environment variables. Deploy the React frontend separately and set its API URL to the public backend URL.
