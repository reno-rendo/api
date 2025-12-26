# Otakudesu API Scraper

RESTful API service yang menyediakan data terstruktur dari situs Otakudesu.best melalui web scraping.

## Features

- 🔍 **Search** - Pencarian anime dengan keyword
- 📺 **Anime Details** - Informasi lengkap anime (synopsis, genres, episodes)
- 🎬 **Streaming** - Akses streaming links dari berbagai server
- 📅 **Schedule** - Jadwal rilis anime mingguan
- ⚡ **Fast** - Redis caching untuk response cepat
- 🛡️ **Secure** - Rate limiting & input validation

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Framework**: Express.js
- **Scraping**: Axios + Cheerio
- **Caching**: Redis
- **Validation**: Zod
- **Testing**: Jest + Supertest

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- Redis Server
- npm or yarn

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/otakudesu-scraper.git
cd otakudesu-scraper

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Start Redis (using Docker)
docker run -d -p 6379:6379 --name redis-dev redis:7-alpine

# Start development server
npm run dev
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | development | Environment mode |
| `PORT` | No | 3000 | Server port |
| `SOURCE_BASE_URL` | Yes | - | Otakudesu website URL |
| `REDIS_HOST` | Yes | localhost | Redis host |
| `REDIS_PORT` | No | 6379 | Redis port |
| `LOG_LEVEL` | No | info | Logging level |

## API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/home` | Homepage data (spotlight, top airing, latest) |
| GET | `/api/anime/:slug` | Anime details |
| GET | `/api/episodes/:slug` | Episode list |
| GET | `/api/servers?epId=...` | Available servers |
| GET | `/api/stream?epId=...&server=...` | Streaming link |
| GET | `/api/search?q=...` | Search anime |
| GET | `/api/genres` | Genre list |
| GET | `/api/schedule` | Weekly schedule |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/detailed` | Detailed health with Redis & source check |

## Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run start        # Start production server
npm run test         # Run tests
npm run test:coverage # Run tests with coverage
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm run format       # Format code with Prettier
npm run typecheck    # TypeScript type checking
```

## Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route handlers
├── services/        # Business logic
├── utils/           # Utility functions
├── middleware/      # Express middleware
├── routes/          # API routes
├── types/           # TypeScript types
├── schemas/         # Zod validation schemas
└── app.ts           # Application entry point
```

## Caching

Data di-cache menggunakan Redis dengan TTL berbeda:

| Data | TTL |
|------|-----|
| Home page | 5 minutes |
| Anime detail | 1 hour |
| Episodes | 30 minutes |
| Servers | 15 minutes |
| Stream links | 5 minutes |
| Search results | 10 minutes |
| Genres | 24 hours |

## Rate Limiting

| Scope | Limit |
|-------|-------|
| Global | 1000 req / 15 min |
| Search | 30 req / min |
| Stream | 20 req / min |
| Proxy | 10 req / min |

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=home
```

## Deployment

### Using Docker

```bash
# Build image
docker build -t otakudesu-api .

# Run with docker-compose
docker-compose up -d
```

### Using PM2

```bash
npm run build
pm2 start ecosystem.config.js --env production
```

## Disclaimer

⚠️ **This API is not affiliated with Otakudesu.**

- All content is scraped from public sources
- For educational and personal use only
- Please respect the source website's terms of service
- Do not use for commercial purposes without permission

## License

MIT
