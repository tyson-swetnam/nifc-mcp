import config from './config.js';
import logger from './logger.js';

/**
 * Simple in-memory cache with TTL support
 * Thread-safe for single-threaded Node.js applications
 */
class Cache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || config.cache.maxSize;
    this.defaultTTL = options.defaultTTL || config.cache.ttlSeconds * 1000; // Convert to ms
    this.cleanupInterval = options.cleanupInterval || config.cache.cleanupInterval * 1000;

    // Storage: Map of key -> { value, expiresAt }
    this.store = new Map();

    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      cleanups: 0,
    };

    // Start automatic cleanup interval
    this.startCleanup();

    logger.debug('Cache initialized', {
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL,
      cleanupInterval: this.cleanupInterval,
    });
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    const entry = this.store.get(key);

    if (!entry) {
      this.stats.misses++;
      logger.logCacheMiss(key);
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      this.stats.misses++;
      logger.logCacheMiss(key);
      return null;
    }

    this.stats.hits++;
    logger.logCacheHit(key);
    return entry.value;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (optional)
   */
  set(key, value, ttl = this.defaultTTL) {
    // Evict oldest entry if at max size
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      this.evictOldest();
    }

    const expiresAt = Date.now() + ttl;

    this.store.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
    });

    this.stats.sets++;

    logger.debug('Cache set', {
      key,
      ttl,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    const entry = this.store.get(key);
    if (!entry) return false;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key was deleted
   */
  delete(key) {
    const deleted = this.store.delete(key);
    if (deleted) {
      this.stats.deletes++;
    }
    return deleted;
  }

  /**
   * Clear entire cache
   */
  clear() {
    const size = this.store.size;
    this.store.clear();
    logger.info('Cache cleared', { entriesRemoved: size });
  }

  /**
   * Evict oldest entry (LRU)
   */
  evictOldest() {
    if (this.store.size === 0) return;

    // Find oldest entry by createdAt
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      this.stats.evictions++;
      logger.debug('Cache eviction', { key: oldestKey });
    }
  }

  /**
   * Remove expired entries
   * @returns {number} Number of entries removed
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.stats.cleanups++;
      logger.debug('Cache cleanup', { entriesRemoved: removed });
    }

    return removed;
  }

  /**
   * Start automatic cleanup interval
   */
  startCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);

    // Don't prevent Node.js from exiting
    this.cleanupTimer.unref();
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      ...this.stats,
      size: this.store.size,
      maxSize: this.maxSize,
      hitRate: hitRate.toFixed(2) + '%',
      totalRequests,
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      cleanups: 0,
    };
  }

  /**
   * Get or set pattern
   * If key exists, return cached value
   * Otherwise, compute value, cache it, and return
   *
   * @param {string} key - Cache key
   * @param {Function} fn - Async function to compute value
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise<any>} Cached or computed value
   */
  async getOrSet(key, fn, ttl = this.defaultTTL) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fn();
    this.set(key, value, ttl);
    return value;
  }
}

// Create singleton instance
const cache = new Cache();

export default cache;
export { Cache };
