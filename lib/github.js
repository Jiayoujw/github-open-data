// Shared GitHub fetch helper + in-memory cache for serverless functions.
// Cache persists only while the lambda container is warm (typically a few minutes).
// For local Express dev, the cache lives as long as the process is running.

const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN || '';
const GITHUB_API = 'https://api.github.com';

const _cache = new Map();
const _maxEntries = 500;

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    _cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value, ttlMs) {
  if (_cache.size >= _maxEntries) {
    const firstKey = _cache.keys().next().value;
    _cache.delete(firstKey);
  }
  _cache.set(key, { value, expires: Date.now() + ttlMs });
}

async function githubFetch(path, opts = {}) {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'github-open-data-explorer',
    ...opts.headers,
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = 'token ' + GITHUB_TOKEN;
  }
  return fetch(GITHUB_API + path, { ...opts, headers });
}

function relayRateLimits(res, srcResp) {
  const setHdr = res.setHeader ? res.setHeader.bind(res) : res.set.bind(res);
  setHdr('X-RateLimit-Remaining', srcResp.headers.get('X-RateLimit-Remaining') || '?');
  setHdr('X-RateLimit-Reset', srcResp.headers.get('X-RateLimit-Reset') || '?');
  setHdr('X-RateLimit-Limit', srcResp.headers.get('X-RateLimit-Limit') || '?');
}

module.exports = { githubFetch, cacheGet, cacheSet, relayRateLimits };
