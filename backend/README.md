# Muze Backend Service

Production-ready, highly modular Node.js backend for the Muze music recommendation engine.

---

## 🏗 Architecture Overview

The backend is built with clean separation of concerns, zero spaghetti code, and resilient cloud design:

```
muze/backend/
├── src/
│   ├── config/
│   │   ├── env.js                # Environment variable loader & validator
│   │   └── constants.js          # Vector dims, TTLs, rate limits, cache keys
│   ├── database/
│   │   ├── connection.js         # Mongoose connection manager with reconnection logic
│   │   └── models/
│   │       ├── song.model.js     # Song metadata schema with text & index lookups
│   │       └── trackVector.model.js # trackId <-> vectorId <-> vector mapping
│   ├── cache/
│   │   ├── memoryCache.js        # High-performance In-Memory LRU Cache (256MB boundary)
│   │   ├── stampedeLock.js       # Singleflight lock preventing DB cache stampedes
│   │   └── cacheManager.js       # Keep-aside caching layer with random TTL jitter
│   ├── storage/
│   │   ├── r2Storage.js          # Cloudflare R2 index artifact downloader
│   │   └── indexLoader.js        # In-memory usearch ANN vector search index
│   ├── services/
│   │   ├── search.service.js     # Song search with text index & regex fallback
│   │   ├── recommend.service.js  # ML retrieval -> FAI Agent filtering -> metadata resolution
│   │   └── fai.service.js        # Python FAI Goal-Based Agent IPC bridge
│   ├── controllers/
│   │   ├── search.controller.js  # GET /search handler
│   │   ├── recommend.controller.js # POST /recommend handler
│   │   └── health.controller.js  # GET /health diagnostics & memory stats
│   ├── middlewares/
│   │   ├── rateLimiter.js        # IP-based rate limiting per endpoint
│   │   ├── errorHandler.js       # Centralized JSON error & 404 handlers
│   │   └── requestLogger.js      # Crisp HTTP latency logger
│   ├── routes/
│   │   ├── search.routes.js
│   │   ├── recommend.routes.js
│   │   └── health.routes.js
│   ├── utils/
│   │   ├── logger.js             # Formatted timestamp logger
│   │   └── jitter.js             # Cache stampede jitter calculator
│   ├── app.js                    # Express app configuration & middleware pipeline
│   └── server.js                 # Server entrypoint with graceful shutdown
├── scripts/
│   ├── uploadToR2.js             # Uploads .usearch & .joblib to Cloudflare R2
│   └── seedMongoVectors.js       # Seeds track vectors from parquet into MongoDB Atlas
└── package.json
```

---

## 🚀 Key Architectural Highlights

1. **Server Memory LRU Cache (256MB Threshold)**:
   - Uses an internal Least-Recently-Used (LRU) cache residing directly inside server memory for sub-millisecond retrieval.
   - Enforces a strict 256MB memory cap, evicting the least-recently-accessed items when memory pressure is reached.
   - Background interval lazily purges expired items.

2. **Cache Stampede & Thundering Herd Prevention**:
   - **Singleflight Lock (`stampedeLock.js`)**: If 50 concurrent requests hit `/search?q=coldplay` during a cache miss, only the first request hits MongoDB Atlas; the remaining 49 await the shared in-flight Promise.
   - **Random TTL Jitter (`jitter.js`)**: All cache writes have +/- 20% random spread applied to their TTL, preventing synchronized cache expiration spikes.

3. **In-Memory Approximate Nearest Neighbor (`usearch`)**:
   - The compiled 17-dimensional `tracks_index.usearch` file is kept resident in memory.
   - Microsecond cosine distance search retrieves the top-K similar vector IDs.

4. **Database Operations with Mongoose**:
   - Fully typed Mongoose models for `Song` (non-statistical fields) and `TrackVector`.
   - Text indexing on song titles and albums with case-insensitive regex fallback.

---

## 📡 API Endpoints

### 1. Song Search
- **Route**: `GET /search?q="song_name"&limit=20`
- **Rate Limit**: 60 requests/minute per IP
- **Description**: Searches for songs matching the query string. Checks cache first, falls back to MongoDB, caches result with jittered TTL.
- **Response**:
```json
{
  "success": true,
  "query": "bohemian rhapsody",
  "count": 1,
  "data": [
    {
      "track_id": "7tFiyTwD0nx5a1eklYtX2J",
      "name": "Bohemian Rhapsody",
      "artists": ["Queen"],
      "album": "A Night At The Opera",
      "duration_ms": 354320,
      "release_date": "1975-11-21",
      "year": 1975,
      "explicit": false
    }
  ]
}
```

### 2. Music Recommendation
- **Route**: `POST /recommend`
- **Rate Limit**: 40 requests/minute per IP
- **Body**:
```json
{
  "track_id": "7tFiyTwD0nx5a1eklYtX2J",
  "top_k": 20
}
```
- **Description**: Performs vector search using the 17-dim audio features in `usearch`. Returns only non-statistical features (duration included).
- **Response**:
```json
{
  "success": true,
  "track_id": "7tFiyTwD0nx5a1eklYtX2J",
  "count": 20,
  "data": [
    {
      "track_id": "3z8h0FGod96e49qvnveaqq",
      "name": "Killer Queen",
      "artists": ["Queen"],
      "album": "Sheer Heart Attack",
      "duration_ms": 180440,
      "release_date": "1974-11-08",
      "year": 1974,
      "explicit": false,
      "similarity_score": 0.9812
    }
  ]
}
```

### 3. Health & Diagnostics
- **Route**: `GET /health`
- **Response**:
```json
{
  "status": "healthy",
  "uptimeSeconds": 1420,
  "database": { "connected": true },
  "vectorIndex": { "isLoaded": true, "vectorCount": 1204022 },
  "cache": {
    "type": "in-memory-lru",
    "itemCount": 420,
    "usedMemoryMb": "14.20",
    "maxMemoryMb": "256",
    "hitRate": "92.4%"
  }
}
```

---

## 🛠 Scripts

- **Upload to Cloudflare R2**:
  ```bash
  npm run upload:r2
  ```
- **Seed Mongo Vectors**:
  ```bash
  npm run seed:vectors
  ```
- **Run in Development**:
  ```bash
  npm run dev
  ```
- **Run in Production**:
  ```bash
  npm start
  ```

