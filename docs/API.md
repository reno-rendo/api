# Otakudesu API Documentation

## Base URL
```
http://localhost:3000
```

## Endpoints

### Health Check

#### Basic Health
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-27T00:00:00.000Z",
  "uptime": 123.45
}
```

#### Detailed Health
```http
GET /health/detailed
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-27T00:00:00.000Z",
  "uptime": 123.45,
  "checks": {
    "api": { "status": "ok" },
    "redis": { "status": "ok" },
    "source": { "status": "ok", "responseTime": 450 }
  }
}
```

---

### Home

```http
GET /api/home
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ongoing": [
      {
        "slug": "anime-slug",
        "title": "Anime Title",
        "thumbnail": "https://...",
        "episode": "Episode 12"
      }
    ],
    "complete": [],
    "latestEpisodes": [
      {
        "slug": "episode-slug",
        "animeSlug": "anime-slug",
        "title": "Anime Title Episode 12",
        "episode": 12,
        "thumbnail": "https://..."
      }
    ]
  },
  "cache": {
    "cached": false,
    "expiresAt": "2025-12-27T00:05:00.000Z"
  }
}
```

---

### Genres

```http
GET /api/genres
```

**Response:**
```json
{
  "success": true,
  "data": {
    "genres": [
      { "slug": "action", "name": "Action" },
      { "slug": "adventure", "name": "Adventure" }
    ],
    "total": 40
  }
}
```

---

### Search

```http
GET /api/search?q={query}&limit={limit}
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| q | string | Yes | - | Search query (1-100 chars) |
| limit | number | No | 20 | Max results (1-50) |

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "spy",
    "results": [
      {
        "slug": "spy-family-sub-indo",
        "title": "Spy x Family",
        "thumbnail": "https://...",
        "genres": ["Action", "Comedy"]
      }
    ],
    "total": 5
  }
}
```

---

### Anime Detail

```http
GET /api/anime/{slug}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "slug": "spy-family-sub-indo",
    "title": "Spy x Family",
    "alternativeTitles": {
      "japanese": "SPY×FAMILY"
    },
    "thumbnail": "https://...",
    "synopsis": "A spy...",
    "score": 8.5,
    "status": "Ongoing",
    "type": "TV",
    "totalEpisodes": 25,
    "duration": "24 min",
    "releaseDate": "April 2022",
    "studio": "WIT Studio",
    "genres": ["Action", "Comedy"],
    "episodeList": [
      {
        "episodeSlug": "spy-family-episode-1-sub-indo",
        "episode": 1,
        "title": "Episode 1"
      }
    ]
  }
}
```

---

### Episodes

```http
GET /api/episodes/{slug}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "animeSlug": "spy-family-sub-indo",
    "animeTitle": "Spy x Family",
    "episodes": [...],
    "totalEpisodes": 25
  }
}
```

---

### Servers

```http
GET /api/servers?epId={episodeSlug}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "episodeSlug": "spy-family-episode-1",
    "episodeTitle": "Episode 1",
    "servers": [
      {
        "name": "Server 1",
        "quality": "720p",
        "type": "streaming",
        "serverId": "server-0"
      }
    ]
  }
}
```

---

### Stream

```http
GET /api/stream?epId={episodeSlug}&server={serverId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "episodeSlug": "spy-family-episode-1",
    "serverName": "Server 1",
    "streamUrl": "https://...",
    "headers": {
      "referer": "https://otakudesu.best"
    },
    "expiresAt": "2025-12-27T00:05:00.000Z"
  }
}
```

---

### Schedule

```http
GET /api/schedule?day={day}
```

| Parameter | Type | Required | Values |
|-----------|------|----------|--------|
| day | string | No | monday, tuesday, ... sunday |

**Response:**
```json
{
  "success": true,
  "data": {
    "schedule": [
      {
        "day": "monday",
        "anime": [
          { "slug": "anime-1", "title": "Anime 1" }
        ]
      }
    ],
    "lastUpdated": "2025-12-27T00:00:00.000Z"
  }
}
```

---

### Batch Download

```http
GET /api/batch/{slug}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "animeSlug": "anime-slug",
    "animeTitle": "Anime Title",
    "batchLinks": [
      {
        "quality": "720p",
        "size": "2.5GB",
        "links": [
          { "host": "GDrive", "url": "https://..." }
        ]
      }
    ]
  }
}
```

---

### Proxy

```http
GET /api/proxy?url={encodedUrl}
```

**Allowed Domains:**
- otakudesu.best
- stream.otakudesu.best
- cdn.otakudesu.best

---

## Error Responses

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Anime not found",
    "timestamp": "2025-12-27T00:00:00.000Z"
  }
}
```

| Code | HTTP Status | Description |
|------|-------------|-------------|
| INVALID_REQUEST | 400 | Bad request parameters |
| VALIDATION_ERROR | 400 | Input validation failed |
| NOT_FOUND | 404 | Resource not found |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| SCRAPING_ERROR | 502 | Failed to scrape source |
| SERVICE_UNAVAILABLE | 503 | Source website down |
| TIMEOUT | 504 | Request timeout |

---

## Rate Limits

| Scope | Limit |
|-------|-------|
| Global | 1000 req / 15 min |
| Search | 30 req / min |
| Stream | 20 req / min |
| Proxy | 10 req / min |

## Cache TTL

| Resource | TTL |
|----------|-----|
| Home | 5 min |
| Anime | 1 hour |
| Episodes | 30 min |
| Servers | 15 min |
| Stream | 5 min |
| Search | 10 min |
| Genres | 24 hours |
| Schedule | 1 hour |
