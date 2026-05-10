const { githubFetch, cacheGet, cacheSet, relayRateLimits } = require('../../../lib/github');

const REPO_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// ── Project type inference ─────────────────────────────────────────
const PROJECT_TYPE_RULES = [
  { key: 'awesome',   label: '⭐ 资源清单',   priority: 10, topics: ['awesome', 'awesome-list', 'list', 'collection', 'resources'] },
  { key: 'tutorial',  label: '📚 教程 / 学习', priority: 9,  topics: ['tutorial', 'learning', 'book', 'course', 'interview', 'study', 'roadmap', 'education', 'guide'] },
  { key: 'template',  label: '🎨 项目模板',   priority: 8,  topics: ['template', 'boilerplate', 'starter', 'starter-kit', 'scaffold', 'starter-template'] },
  { key: 'cli',       label: '⌨️ 命令行工具',  priority: 7,  topics: ['cli', 'command-line', 'command-line-tool', 'terminal', 'shell', 'tui'] },
  { key: 'plugin',    label: '🔌 插件 / 扩展', priority: 7,  topics: ['plugin', 'extension', 'vscode-extension', 'chrome-extension', 'addon'] },
  { key: 'framework', label: '🏗 框架',        priority: 6,  topics: ['framework', 'web-framework', 'mvc'] },
  { key: 'library',   label: '📦 库 / SDK',    priority: 5,  topics: ['library', 'sdk', 'npm-package', 'package', 'module'] },
  { key: 'app',       label: '📱 应用',        priority: 4,  topics: ['app', 'application', 'desktop-app', 'mobile-app', 'android', 'ios', 'electron', 'pwa'] },
  { key: 'docs',      label: '📄 文档',        priority: 3,  topics: ['documentation', 'docs', 'wiki', 'reference', 'specification'] },
  { key: 'dataset',   label: '📊 数据集',      priority: 3,  topics: ['dataset', 'data', 'corpus'] },
];

function inferProjectType(repo) {
  const topics = (repo.topics || []).map(function (t) { return String(t).toLowerCase(); });
  const fullName = (repo.full_name || repo.name || '').toLowerCase();

  for (let i = 0; i < PROJECT_TYPE_RULES.length; i++) {
    const rule = PROJECT_TYPE_RULES[i];
    if (rule.topics.some(function (t) { return topics.indexOf(t) >= 0; })) {
      return { key: rule.key, label: rule.label };
    }
  }

  if (/awesome[-_]/.test(fullName) || fullName.startsWith('awesome-')) {
    return { key: 'awesome', label: '⭐ 资源清单' };
  }
  if (repo.language) {
    return { key: 'lang', label: '💻 ' + repo.language + ' 项目' };
  }
  return { key: 'other', label: '📦 项目' };
}

// ── README install command extraction ─────────────────────────────
const INSTALL_PATTERNS = [
  /(?:^|\s)(npm\s+(?:install|i|add)\s+[^\n`]+)/gim,
  /(?:^|\s)(yarn\s+add\s+[^\n`]+)/gim,
  /(?:^|\s)(pnpm\s+(?:install|add|i)\s+[^\n`]+)/gim,
  /(?:^|\s)(pip3?\s+install\s+[^\n`]+)/gim,
  /(?:^|\s)(pipx\s+install\s+[^\n`]+)/gim,
  /(?:^|\s)(go\s+(?:get|install)\s+[^\n`]+)/gim,
  /(?:^|\s)(cargo\s+(?:install|add)\s+[^\n`]+)/gim,
  /(?:^|\s)(brew\s+install\s+[^\n`]+)/gim,
  /(?:^|\s)(apt(?:-get)?\s+install\s+[^\n`]+)/gim,
  /(?:^|\s)(docker\s+pull\s+[^\n`]+)/gim,
  /(?:^|\s)(docker\s+run\s+[^\n`]+)/gim,
  /(?:^|\s)(gem\s+install\s+[^\n`]+)/gim,
  /(?:^|\s)(composer\s+require\s+[^\n`]+)/gim,
  /(?:^|\s)(curl\s+-[^\n`]+\s*\|\s*(?:bash|sh)[^\n`]*)/gim,
  /(?:^|\s)(git\s+clone\s+https?:\/\/[^\s`]+)/gim,
];

function extractInstallCommands(readme) {
  if (!readme) return [];
  const commands = [];
  const seen = new Set();

  const codeBlocks = [];
  const blockRegex = /```[\w-]*\n?([\s\S]*?)```/g;
  let m;
  while ((m = blockRegex.exec(readme)) !== null) {
    codeBlocks.push(m[1]);
    if (codeBlocks.length > 30) break;
  }

  const sources = codeBlocks.length ? codeBlocks : [readme];
  for (const src of sources) {
    for (const pattern of INSTALL_PATTERNS) {
      pattern.lastIndex = 0;
      let pm;
      while ((pm = pattern.exec(src)) !== null) {
        const cmd = pm[1].trim().replace(/[`*_]/g, '');
        if (cmd.length < 3 || cmd.length > 200) continue;
        if (seen.has(cmd)) continue;
        seen.add(cmd);
        commands.push(cmd);
        if (commands.length >= 5) return commands;
      }
    }
    if (commands.length >= 3) break;
  }
  return commands;
}

// ── README usage snippet extraction ───────────────────────────────
const USAGE_HEADING_REGEX = /^(#{1,4})\s+(?:Usage|Quick\s*Start|Quickstart|Getting\s*Started|Example[s]?|Basic\s*Usage|快速开始|快速入门|使用方法|用法|入门|示例|示例代码)\s*$/im;

function extractUsageSnippet(readme) {
  if (!readme) return null;
  const match = readme.match(USAGE_HEADING_REGEX);
  if (!match) return null;
  const startIdx = match.index + match[0].length;
  const rest = readme.substring(startIdx);
  const nextHeadingMatch = rest.match(/\n#{1,4}\s+\S/);
  const sectionContent = nextHeadingMatch ? rest.substring(0, nextHeadingMatch.index) : rest.substring(0, 3000);

  const codeBlockMatch = sectionContent.match(/```([\w-]*)\n?([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[2].trim().length > 0) {
    return {
      lang: codeBlockMatch[1] || '',
      code: codeBlockMatch[2].trim().substring(0, 600),
    };
  }
  return null;
}

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
      project_type: inferProjectType(repo),
      install_commands: extractInstallCommands(readmeContent),
      usage_snippet: extractUsageSnippet(readmeContent),
    };

    cacheSet(key, result, REPO_TTL_MS);
    res.setHeader('X-Cache', 'MISS');
    res.status(200).json(result);
  } catch (err) {
    console.error('Repo detail error:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
};
