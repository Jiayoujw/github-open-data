const { githubFetch, cacheGet, cacheSet, relayRateLimits } = require('../lib/github');

const SEARCH_TTL_MS = 1000 * 60 * 60; // 1 hour

module.exports = async function handler(req, res) {
  try {
    const { q, sort, order, page, per_page } = req.query;
    if (!q) {
      res.status(400).json({ error: 'Missing query "q"' });
      return;
    }

    const key = JSON.stringify({ q, sort, order, page: page || '1', per_page: per_page || '30' });
    const cached = cacheGet(key);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.status(200).json(cached);
      return;
    }

    const params = new URLSearchParams({
      q,
      sort: sort || 'stars',
      order: order || 'desc',
      page: page || '1',
      per_page: per_page || '30',
    });
    const resp = await githubFetch('/search/repositories?' + params.toString());
    relayRateLimits(res, resp);

    if (!resp.ok) {
      if (resp.status === 403) {
        res.status(429).json({ error: 'API 请求次数已用完，请稍后再试。' });
        return;
      }
      if (resp.status === 422) {
        res.status(400).json({ error: '搜索查询格式有误，请简化关键词后重试。' });
        return;
      }
      res.status(resp.status).json({ error: '请求失败 (HTTP ' + resp.status + ')' });
      return;
    }

    const data = await resp.json();
    cacheSet(key, data, SEARCH_TTL_MS);
    res.setHeader('X-Cache', 'MISS');
    res.status(200).json(data);
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
};
