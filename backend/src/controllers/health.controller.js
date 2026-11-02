/**
 * Health & Diagnostics Controller
 * --------------------------------
 * Reports status of server memory, cache metrics, MongoDB connection,
 * and vector index initialization.
 */

import { isDBConnected } from '../database/connection.js';
import { vectorIndexManager } from '../storage/indexLoader.js';
import { cacheManager } from '../cache/cacheManager.js';

export function handleHealthCheck(req, res) {
  const isConnected = isDBConnected();
  const indexStatus = vectorIndexManager.getStatus();
  const cacheStats = cacheManager.getStats();

  const isHealthy = isConnected && indexStatus.isLoaded;

  return res.status(isHealthy ? 200 : 207).json({
    status: isHealthy ? 'healthy' : 'degraded',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: { songsConnected: isConnected },
    vectorIndex: indexStatus,
    cache: cacheStats,
    processMemory: {
      rssMb: (process.memoryUsage().rss / (1024 * 1024)).toFixed(1),
      heapUsedMb: (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(1),
      heapTotalMb: (process.memoryUsage().heapTotal / (1024 * 1024)).toFixed(1),
    },
  });
}

