const { githubFetch, cacheGet, cacheSet, relayRateLimits } = require('../../../lib/github');

const REPO_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

module.exports = async function handler(req, res) {
  try {
    const { owner, name } = req.query;
    if (!owner || !name) {
      res.status(400).json({ error: '缺少 owner 或 name 参数' });
      return;
    }

    const key = owner + '/' + name;
    const cached = cacheGet(key);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.status(200).json(cached);
      return;
    }

    const [repoResp, readmeResp, contribResp, releasesResp, langResp] = await Promise.all([
      githubFetch('/repos/' + owner + '/' + name),
      githubFetch('/repos/' + owner + '/' + name + '/readme'),
      githubFetch('/repos/' + owner + '/' + name + '/contributors?per_page=1&anon=true'),
      githubFetch('/repos/' + owner + '/' + name + '/releases?per_page=1'),
      githubFetch('/repos/' + owner + '/' + name + '/languages'),
    ]);

    relayRateLimits(res, repoResp);

    if (!repoResp.ok) {
      res.status(repoResp.status).json({ error: '仓库不存在或无法访问' });
      return;
    }

    const repo = await repoResp.json();

    let readmeContent = null;
    if (readmeResp.ok) {
      const readmeJson = await readmeResp.json();
      readmeContent = Buffer.from(readmeJson.content, 'base64').toString('utf-8');
    }

    let contributors_count = 0;
    if (contribResp.ok) {
      const link = contribResp.headers.get('Link');
      if (link) {
        const match = link.match(/page=(\d+)>; rel="last"/);
        contributors_count = match ? parseInt(match[1]) : 1;
      } else {
        const contribData = await contribResp.json();
        contributors_count = Array.isArray(contribData) ? contribData.length : 0;
      }
    }

    let releases_count = 0;
    let latest_release = null;
    if (releasesResp.ok) {
      const link = releasesResp.headers.get('Link');
      if (link) {
        const match = link.match(/page=(\d+)>; rel="last"/);
        releases_count = match ? parseInt(match[1]) : 1;
      } else {
        const relData = await releasesResp.json();
        releases_count = Array.isArray(relData) ? relData.length : 0;
        if (relData.length > 0) {
          latest_release = { tag_name: relData[0].tag_name, published_at: relData[0].published_at };
        }
      }
    }

    let languages = {};
    if (langResp.ok) languages = await langResp.json();

    const result = {
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description,
      language: repo.language,
      topics: repo.topics,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      open_issues_count: repo.open_issues_count,
      watchers_count: repo.watchers_count,
      subscribers_count: repo.subscribers_count,
      network_count: repo.network_count,
      license: repo.license,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      pushed_at: repo.pushed_at,
      homepage: repo.homepage,
      default_branch: repo.default_branch,
      archived: repo.archived,
      has_issues: repo.has_issues,
      has_projects: repo.has_projects,
      has_wiki: repo.has_wiki,
      has_pages: repo.has_pages,
      has_discussions: repo.has_discussions,
      size: repo.size,
      owner: {
        login: repo.owner.login,
        avatar_url: repo.owner.avatar_url,
        html_url: repo.owner.html_url,
        type: repo.owner.type,
      },
      contributors_count,
      releases_count,
      latest_release,
      languages,
      readme: readmeContent ? readmeContent.substring(0, 15000) : null,
      readme_truncated: readmeContent ? readmeContent.length > 15000 : false,
    };

    cacheSet(key, result, REPO_TTL_MS);
    res.setHeader('X-Cache', 'MISS');
    res.status(200).json(result);
  } catch (err) {
    console.error('Repo detail error:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
};
