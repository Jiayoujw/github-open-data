(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // DOM refs
  // ═══════════════════════════════════════════════════════════
  var searchInput = document.getElementById('searchInput');
  var searchBtn = document.getElementById('searchBtn');
  var languageFilter = document.getElementById('languageFilter');
  var sortFilter = document.getElementById('sortFilter');
  var minStars = document.getElementById('minStars');
  var resultsGrid = document.getElementById('resultsGrid');
  var emptyState = document.getElementById('emptyState');
  var skeleton = document.getElementById('skeleton');
  var errorBox = document.getElementById('error');
  var errorMsg = document.getElementById('errorMsg');
  var retryBtn = document.getElementById('retryBtn');
  var statsBar = document.getElementById('statsBar');
  var resultCount = document.getElementById('resultCount');
  var cacheHit = document.getElementById('cacheHit');
  var rateLimit = document.getElementById('rateLimit');
  var pagination = document.getElementById('pagination');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var pageInfo = document.getElementById('pageInfo');
  var modal = document.getElementById('detailModal');
  var modalBody = document.getElementById('modalBody');
  var modalClose = document.getElementById('modalClose');
  var heroSection = document.getElementById('heroSection');
  var logoHome = document.getElementById('logoHome');
  var themeToggle = document.getElementById('themeToggle');
  var suggestions = document.getElementById('suggestions');
  // Phase A additions
  var navLinks = document.querySelectorAll('.nav-link');
  var bookmarkBadge = document.getElementById('bookmarkBadge');
  var viewHome = document.getElementById('viewHome');
  var viewCollections = document.getElementById('viewCollections');
  var categoriesSection = document.getElementById('categoriesSection');
  var recentSection = document.getElementById('recentSection');
  var categoryTabs = document.getElementById('categoryTabs');
  var categoryGrid = document.getElementById('categoryGrid');
  var recentGrid = document.getElementById('recentGrid');
  var searchSection = document.getElementById('searchSection');
  var collectionSearch = document.getElementById('collectionSearch');
  var collectionFilters = document.getElementById('collectionFilters');
  var collectionsEmpty = document.getElementById('collectionsEmpty');
  var collectionsGroups = document.getElementById('collectionsGroups');
  var collectionsSummary = document.getElementById('collectionsSummary');
  var exportBtn = document.getElementById('exportBtn');
  var toast = document.getElementById('toast');
  var backTop = document.getElementById('backTop');

  // ═══════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════
  var currentPage = 1;
  var totalPages = 1;
  var currentQuery = '';
  var debounceTimer = null;
  var suggestionIndex = -1;

  // ═══════════════════════════════════════════════════════════
  // Dark mode
  // ═══════════════════════════════════════════════════════════
  var darkMode = localStorage.getItem('darkMode') === 'true';
  applyTheme();

  themeToggle.addEventListener('click', function () {
    darkMode = !darkMode;
    localStorage.setItem('darkMode', darkMode);
    applyTheme();
  });

  function applyTheme() {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      themeToggle.querySelector('.theme-icon').textContent = '☀️';
    } else {
      document.documentElement.removeAttribute('data-theme');
      themeToggle.querySelector('.theme-icon').textContent = '🌙';
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Language color map
  // ═══════════════════════════════════════════════════════════
  var langColors = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
    Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', 'C++': '#f34b7d',
    C: '#555555', Ruby: '#701516', Swift: '#F05138', Kotlin: '#A97BFF',
    PHP: '#4F5D95', Vue: '#41b883', HTML: '#e34c26', CSS: '#563d7c',
    Shell: '#89e051', Scala: '#c22d40', Dart: '#00B4AB', Lua: '#000080',
    Elixir: '#6e4a7e', Haskell: '#5e5086', Clojure: '#db5855',
    'Jupyter Notebook': '#DA5B0B',
  };

  // ═══════════════════════════════════════════════════════════
  // Search suggestions
  // ═══════════════════════════════════════════════════════════
  var popularSuggestions = [
    { q: 'machine learning', icon: '🤖', label: '机器学习' },
    { q: 'react component', icon: '⚛️', label: 'React 组件' },
    { q: 'llm chatgpt', icon: '🧠', label: '大模型 / LLM' },
    { q: 'rust cli tool', icon: '🦀', label: 'Rust CLI 工具' },
    { q: 'python framework', icon: '🐍', label: 'Python 框架' },
    { q: 'go microservice', icon: '🔷', label: 'Go 微服务' },
    { q: 'awesome list', icon: '⭐', label: 'Awesome 精选列表' },
    { q: 'typescript library', icon: '📘', label: 'TypeScript 库' },
    { q: 'devtools vscode extension', icon: '🛠', label: 'VS Code 扩展' },
    { q: 'game engine', icon: '🎮', label: '游戏引擎' },
  ];

  function showSuggestions() {
    var val = searchInput.value.trim().toLowerCase();
    var filtered = val ? popularSuggestions.filter(function (s) {
      return s.q.indexOf(val) >= 0 || s.label.toLowerCase().indexOf(val) >= 0;
    }) : popularSuggestions;

    if (filtered.length === 0) {
      suggestions.classList.remove('active');
      return;
    }

    suggestions.innerHTML = filtered.map(function (s, i) {
      return '<div class="suggestion-item' + (i === 0 ? ' active' : '') + '" data-query="' + escapeHtml(s.q) + '">' +
        '<span class="suggestion-icon">' + s.icon + '</span>' +
        '<span>' + escapeHtml(s.label) + ' <small style="color:var(--text-muted)">' + escapeHtml(s.q) + '</small></span>' +
      '</div>';
    }).join('');

    suggestions.classList.add('active');
    suggestionIndex = -1;
  }

  function hideSuggestions() {
    suggestions.classList.remove('active');
    suggestionIndex = -1;
  }

  function selectSuggestion(query) {
    searchInput.value = query;
    hideSuggestions();
    currentPage = 1;
    doSearch(query);
  }

  // ═══════════════════════════════════════════════════════════
  // Build search query
  // ═══════════════════════════════════════════════════════════
  function buildQuery(base) {
    var parts = [base.trim()];
    var lang = languageFilter.value;
    var stars = minStars.value;
    if (lang) parts.push('language:' + lang);
    if (stars && stars !== '0') parts.push('stars:>=' + stars);
    return parts.filter(Boolean).join(' ');
  }

  // ═══════════════════════════════════════════════════════════
  // Fetch from backend proxy
  // ═══════════════════════════════════════════════════════════
  function searchRepos(query, page) {
    var q = buildQuery(query);
    if (!q) return Promise.resolve(null);

    var sort = sortFilter.value;
    var params = new URLSearchParams({ q: q, sort: sort, order: 'desc', page: page, per_page: 30 });
    var url = '/api/search?' + params.toString();

    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 15000);

    return fetch(url, { signal: controller.signal })
      .then(function (resp) {
        var remaining = resp.headers.get('X-RateLimit-Remaining');
        var resetTime = resp.headers.get('X-RateLimit-Reset');
        if (remaining !== null) {
          var resetDate = new Date(resetTime * 1000);
          rateLimit.textContent = '剩余 ' + remaining + ' 次 · 重置 ' +
            resetDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        }
        if (resp.headers.get('X-Cache') === 'HIT') {
          cacheHit.style.display = '';
        } else {
          cacheHit.style.display = 'none';
        }
        return resp.json().then(function (data) {
          if (!resp.ok) throw new Error(data.error || '请求失败 (HTTP ' + resp.status + ')');
          return data;
        });
      })
      .finally(function () { clearTimeout(timeout); });
  }

  // ═══════════════════════════════════════════════════════════
  // Search term highlighting
  // ═══════════════════════════════════════════════════════════
  function highlightTerm(text, query) {
    if (!query) return escapeHtml(text);
    var words = query.split(/\s+/).filter(function (w) { return w.length > 1; });
    var result = escapeHtml(text);
    words.forEach(function (word) {
      var escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var regex = new RegExp('(' + escaped + ')', 'gi');
      result = result.replace(regex, '<mark class="search-highlight">$1</mark>');
    });
    return result;
  }

  // ═══════════════════════════════════════════════════════════
  // localStorage bookmarks
  // ═══════════════════════════════════════════════════════════
  function getBookmarks() {
    try { return JSON.parse(localStorage.getItem('savedRepos') || '[]'); } catch (e) { return []; }
  }

  function saveBookmarks(list) {
    localStorage.setItem('savedRepos', JSON.stringify(list));
  }

  function toggleBookmark(repo) {
    var bookmarks = getBookmarks();
    var idx = bookmarks.findIndex(function (b) { return b.full_name === repo.full_name; });
    if (idx >= 0) {
      bookmarks.splice(idx, 1);
    } else {
      bookmarks.push({
        full_name: repo.full_name,
        html_url: repo.html_url,
        description: repo.description,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        topics: repo.topics,
        savedAt: new Date().toISOString(),
      });
    }
    saveBookmarks(bookmarks);
    return idx < 0; // true = now saved
  }

  function isBookmarked(fullName) {
    return getBookmarks().some(function (b) { return b.full_name === fullName; });
  }

  // ═══════════════════════════════════════════════════════════
  // Render repo card
  // ═══════════════════════════════════════════════════════════
  function renderCard(repo) {
    var langColor = langColors[repo.language] || '#8b949e';
    var timeAgo = formatTimeAgo(new Date(repo.updated_at));
    var topics = (repo.topics || []).slice(0, 5);
    var saved = isBookmarked(repo.full_name);
    var searchTerm = currentQuery.replace(/language:\S+/g, '').replace(/stars:>=\d+/g, '').trim();

    return '<article class="repo-card" data-owner="' + escapeHtml(repo.owner.login) + '" data-repo="' + escapeHtml(repo.name) + '">' +
      '<div class="repo-card-header">' +
        '<svg class="repo-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
          '<path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 01-.75-.75v-2.5h-1v2.5a.75.75 0 01-.75.75h-2.5A.75.75 0 015 12.5v-2.5H4v2.5a.75.75 0 01-.75.75H.75a.75.75 0 01-.75-.75v-10A2.5 2.5 0 012 2.5z"/>' +
        '</svg>' +
        '<div>' +
          '<a class="repo-name" href="' + repo.html_url + '" target="_blank" rel="noopener">' + highlightTerm(repo.full_name, searchTerm) + '</a>' +
          (repo.archived ? '<span class="repo-visibility">Archived</span>' : '') +
        '</div>' +
      '</div>' +
      '<p class="repo-description">' + highlightTerm(repo.description || '暂无描述', searchTerm) + '</p>' +
      '<div class="repo-meta">' +
        (repo.language ? '<span class="meta-item"><span class="language-dot" style="background:' + langColor + '"></span>' + escapeHtml(repo.language) + '</span>' : '') +
        '<span class="meta-item" title="Stars">' +
          '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.751.751 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>' +
          formatNumber(repo.stargazers_count) +
        '</span>' +
        '<span class="meta-item" title="Forks">' +
          '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75v-.878a2.25 2.25 0 115.25-.75v.878a2.25 2.25 0 01-2.25 2.25H9.5v1.128a2.251 2.251 0 11-1.5 0V6.5H6.75A2.25 2.25 0 014.5 4.25v-.628a2.25 2.25 0 111.5 0V5.372z"/></svg>' +
          formatNumber(repo.forks_count) +
        '</span>' +
        '<span class="meta-item" title="更新">' +
          '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 110 16A8 8 0 018 0zm0 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zm-.25 2.75A.75.75 0 018.5 5v3.69l2.28 2.28a.75.75 0 11-1.06 1.06l-2.5-2.5A.75.75 0 017.75 9V5a.75.75 0 01.75-.75z"/></svg>' +
          timeAgo +
        '</span>' +
        (repo.license ? '<span class="meta-item">' + escapeHtml(repo.license.spdx_id || repo.license.key) + '</span>' : '') +
      '</div>' +
      (topics.length ? '<div class="repo-topics">' + topics.map(function (t) { return '<span class="topic-tag">' + escapeHtml(t) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="repo-card-footer">' +
        '<span style="font-size:0.73rem;color:var(--text-muted)">⭐ ' + formatNumber(repo.stargazers_count) + ' · 🍴 ' + formatNumber(repo.forks_count) + '</span>' +
        '<div class="card-actions">' +
          '<button class="btn-save' + (saved ? ' saved' : '') + '" data-fullname="' + escapeHtml(repo.full_name) + '">' + (saved ? '已收藏' : '收藏') + '</button>' +
          '<button class="btn-detail" data-owner="' + escapeHtml(repo.owner.login) + '" data-repo="' + escapeHtml(repo.name) + '">详情</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  // ═══════════════════════════════════════════════════════════
  // Render results
  // ═══════════════════════════════════════════════════════════
  function renderResults(data) {
    resultsGrid.innerHTML = '';
    emptyState.style.display = 'none';
    errorBox.style.display = 'none';
    hideHero();

    if (!data || data.items.length === 0) {
      emptyState.innerHTML =
        '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35">' +
          '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>' +
        '</svg>' +
        '<h2>没有找到结果</h2>' +
        '<p>尝试更换关键词或调整筛选条件</p>';
      emptyState.style.display = '';
      pagination.style.display = 'none';
      return;
    }

    totalPages = Math.min(Math.ceil(data.total_count / 30), 34);
    resultCount.innerHTML = '找到 <strong>' + formatNumber(data.total_count) + '</strong> 个仓库';

    data.items.forEach(function (repo) {
      resultsGrid.insertAdjacentHTML('beforeend', renderCard(repo));
    });

    // Bind card clicks
    resultsGrid.querySelectorAll('.repo-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('button') || e.target.closest('a')) return;
        openDetail(card.dataset.owner, card.dataset.repo);
      });
    });

    // Bind detail buttons
    resultsGrid.querySelectorAll('.btn-detail').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openDetail(btn.dataset.owner, btn.dataset.repo);
      });
    });

    // Bind save/bookmark buttons
    resultsGrid.querySelectorAll('.btn-save').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var fullName = btn.dataset.fullname;
        var repoItem = data.items.find(function (r) { return r.full_name === fullName; });
        if (!repoItem) return;
        var nowSaved = toggleBookmark(repoItem);
        btn.textContent = nowSaved ? '已收藏' : '收藏';
        btn.classList.toggle('saved', nowSaved);
        showToast(nowSaved ? '已添加到收藏夹 ✨' : '已从收藏夹移除');
        updateBookmarkBadge();
      });
    });

    pagination.style.display = totalPages > 1 ? '' : 'none';
    updatePagination();
  }

  function hideHero() {
    if (heroSection) heroSection.style.display = 'none';
    hideDiscover();
    if (statsBar) statsBar.style.display = '';
  }

  function showHero() {
    if (heroSection) heroSection.style.display = '';
    showDiscover();
    if (statsBar) statsBar.style.display = 'none';
  }

  // ═══════════════════════════════════════════════════════════
  // Detail modal (with marked.js)
  // ═══════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════
  // Evaluation scoring engine
  // ═══════════════════════════════════════════════════════════
  function evaluateRepo(data) {
    // Popularity: log-scale stars (0-100)
    var starsScore = Math.min(100, Math.round(Math.log(data.stargazers_count + 1) / Math.log(400000) * 100));
    // Community: forks + contributors combined
    var forksScore = Math.min(100, Math.round(Math.log(data.forks_count + 1) / Math.log(100000) * 100));
    var contribScore = data.contributors_count ? Math.min(100, Math.round(data.contributors_count / 50 * 100)) : 30;
    // Documentation: README presence + length + homepage + wiki
    var docsScore = 0;
    if (data.readme && data.readme.length > 5000) docsScore += 35;
    else if (data.readme && data.readme.length > 1000) docsScore += 25;
    else if (data.readme) docsScore += 10;
    if (data.homepage) docsScore += 25;
    if (data.has_wiki) docsScore += 15;
    if (data.has_pages) docsScore += 15;
    if (data.description && data.description.length > 50) docsScore += 10;
    docsScore = Math.min(100, docsScore);
    // Maintenance: recency of push
    var daysSincePush = Math.max(0, (Date.now() - new Date(data.pushed_at).getTime()) / 86400000);
    var maintScore = daysSincePush < 7 ? 100 : daysSincePush < 30 ? 85 : daysSincePush < 90 ? 65 : daysSincePush < 180 ? 45 : daysSincePush < 365 ? 25 : 10;
    // Maturity: age + license + releases
    var daysSinceCreate = Math.max(1, (Date.now() - new Date(data.created_at).getTime()) / 86400000);
    var maturityScore = Math.min(100, Math.round(Math.log(daysSinceCreate) / Math.log(3650) * 80));
    if (data.license) maturityScore = Math.min(100, maturityScore + 15);
    if (data.releases_count > 10) maturityScore = Math.min(100, maturityScore + 10);
    else if (data.releases_count > 0) maturityScore = Math.min(100, maturityScore + 5);
    // Health: issue ratio
    var issueRatio = data.stargazers_count > 0 ? data.open_issues_count / data.stargazers_count : 1;
    var healthScore = issueRatio < 0.001 ? 100 : issueRatio < 0.005 ? 80 : issueRatio < 0.01 ? 60 : issueRatio < 0.05 ? 40 : 20;

    var dimensions = [
      { name: '流行度', score: starsScore, icon: '🌟', desc: starsScore >= 80 ? '顶级热门' : starsScore >= 50 ? '广受欢迎' : starsScore >= 20 ? '有一定知名度' : '新兴项目' },
      { name: '社区规模', score: Math.round((forksScore + contribScore) / 2), icon: '👥', desc: (forksScore + contribScore) / 2 >= 60 ? '社区活跃' : (forksScore + contribScore) / 2 >= 30 ? '成长中' : '社区较小' },
      { name: '文档质量', score: docsScore, icon: '📚', desc: docsScore >= 70 ? '文档完善' : docsScore >= 40 ? '文档较全' : docsScore >= 15 ? '有基础文档' : '文档欠缺' },
      { name: '维护活跃', score: maintScore, icon: '🔄', desc: maintScore >= 85 ? '积极维护中' : maintScore >= 45 ? '维护频率一般' : '维护不活跃' },
      { name: '成熟度', score: maturityScore, icon: '🏛️', desc: maturityScore >= 70 ? '成熟稳定' : maturityScore >= 40 ? '成长阶段' : '早期项目' },
      { name: '代码健康', score: healthScore, icon: '💚', desc: healthScore >= 80 ? 'Issue 比例健康' : healthScore >= 50 ? '正常范围' : 'Issue 积压较多' },
    ];

    var overall = Math.round(dimensions.reduce(function (s, d) { return s + d.score; }, 0) / dimensions.length);

    var grade = overall >= 85 ? { text: '强烈推荐', cls: 'high' } :
                overall >= 70 ? { text: '推荐使用', cls: 'high' } :
                overall >= 55 ? { text: '值得关注', cls: 'medium' } :
                overall >= 35 ? { text: '谨慎评估', cls: 'medium' } :
                { text: '早期观望', cls: 'low' };

    return { overall: overall, grade: grade, dimensions: dimensions };
  }

  // Extract key info from README for introduction
  function extractIntro(data) {
    var features = [];
    if (data.readme) {
      var lines = data.readme.split('\n');
      var capturing = false;
      for (var i = 0; i < Math.min(lines.length, 120); i++) {
        var line = lines[i].trim();
        // Grab the first meaningful paragraph after the title
        if (!capturing && line.length > 30 && !line.startsWith('#') && !line.startsWith('!') && !line.startsWith('[') && !line.startsWith('```') && !line.startsWith('<')) {
          capturing = true;
        }
        if (capturing && line.length > 20 && features.length < 3) {
          // Extract bullet points or key sentences
          if (line.startsWith('- ') || line.startsWith('* ')) {
            features.push(line.replace(/^[-*]\s+/, ''));
          } else if (features.length === 0) {
            features.push(line);
          }
        }
        if (features.length >= 3 || (capturing && line.startsWith('##'))) break;
      }
    }
    return features;
  }

  // ═══════════════════════════════════════════════════════════
  // Detail modal with tabs: 介绍 | 统计 | README | 测评
  // ═══════════════════════════════════════════════════════════
  function openDetail(owner, repo) {
    var fullName = owner + '/' + repo;
    modalBody.innerHTML = '<div class="modal-loading"><div class="spinner"></div><p>加载中...</p></div>';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    fetch('/api/repo/' + owner + '/' + repo)
      .then(function (resp) { return resp.json().then(function (data) { return { ok: resp.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok) {
          modalBody.innerHTML = '<div class="error-box">' + escapeHtml(result.data.error || '加载失败') + '</div>';
          return;
        }
        try {
          renderDetailModal(result.data);
        } catch (err) {
          console.error('renderDetailModal failed:', err);
          modalBody.innerHTML = '<div class="error-box">渲染错误: ' + escapeHtml(err.message || String(err)) + '<br><small>请打开浏览器控制台（F12）查看完整错误信息</small></div>';
        }
      })
      .catch(function (err) {
        modalBody.innerHTML = '<div class="error-box">网络错误: ' + escapeHtml(err.message) + '</div>';
      });
  }

  function renderDetailModal(data) {
    var langColor = langColors[data.language] || '#8b949e';
    var evalResult = evaluateRepo(data);
    var introFeatures = extractIntro(data);
    var readmeHtml = '';
    if (data.readme) {
      try { readmeHtml = marked.parse(data.readme); } catch (e) {
        readmeHtml = '<pre style="white-space:pre-wrap;font-size:0.8rem">' + escapeHtml(data.readme) + '</pre>';
      }
    }

    // Language bar
    var langBar = '';
    var langLegend = '';
    if (data.languages && Object.keys(data.languages).length > 0) {
      var langEntries = Object.entries(data.languages).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
      var totalBytes = langEntries.reduce(function (s, e) { return s + e[1]; }, 0);
      var langBarColors = ['#3572A5','#f1e05a','#b07219','#00ADD8','#dea584','#3178c6','#41b883','#F05138','#DA5B0B','#563d7c'];
      langBar = '<div class="lang-bar">';
      langLegend = '<div class="lang-legend">';
      langEntries.forEach(function (entry, i) {
        var pct = ((entry[1] / totalBytes) * 100).toFixed(1);
        var color = langBarColors[i % langBarColors.length];
        langBar += '<div class="lang-bar-segment" style="width:' + pct + '%;background:' + color + '" title="' + entry[0] + ': ' + pct + '%"></div>';
        langLegend += '<span class="lang-legend-item"><span class="lang-legend-dot" style="background:' + color + '"></span>' + escapeHtml(entry[0]) + ' ' + pct + '%</span>';
      });
      langBar += '</div>';
      langLegend += '</div>';
    }

    // Load user notes
    var fullName = data.full_name;
    var userNotes = getUserNote(fullName);

    modalBody.innerHTML =
      // Tabs
      '<div class="modal-tabs">' +
        '<button class="modal-tab active" data-tab="intro">📋 介绍</button>' +
        '<button class="modal-tab" data-tab="stats">📊 统计</button>' +
        '<button class="modal-tab" data-tab="readme">📄 README</button>' +
        '<button class="modal-tab" data-tab="eval">📝 测评</button>' +
      '</div>' +

      // Header
      '<div class="detail-header">' +
        '<div class="detail-owner">' +
          '<img src="' + data.owner.avatar_url + '" alt="" width="44" height="44" class="detail-avatar" loading="lazy">' +
          '<div>' +
            '<h2><a href="' + data.html_url + '" target="_blank" rel="noopener">' + escapeHtml(data.full_name) + '</a></h2>' +
            '<p class="detail-owner-name">' + escapeHtml(data.owner.login) + ' · ' + data.owner.type + '</p>' +
          '</div>' +
        '</div>' +
        '<p class="detail-description" style="margin-top:10px">' + escapeHtml(data.description || '暂无描述') + '</p>' +
        (data.topics && data.topics.length ? '<div class="repo-topics">' + data.topics.map(function (t) { return '<span class="topic-tag">' + escapeHtml(t) + '</span>'; }).join('') + '</div>' : '') +
        (data.homepage ? '<p class="detail-homepage" style="margin-top:8px">🔗 <a href="' + escapeHtml(data.homepage) + '" target="_blank" rel="noopener">' + escapeHtml(data.homepage) + '</a></p>' : '') +
      '</div>' +

      // Tab: 介绍 (Intro)
      '<div class="tab-content active" data-tab-content="intro">' +
        '<div class="repo-intro-box">' +
          '<h3>🔍 项目概述</h3>' +
          '<p>' + escapeHtml(data.description || '该项目未提供描述信息。') + '</p>' +
          (introFeatures.length ? '<p style="margin-top:10px">从 README 中提取的关键信息：</p>' +
            '<div class="repo-key-points">' + introFeatures.map(function (f) { return '<span class="key-point">' + escapeHtml(f.substring(0, 100)) + '</span>'; }).join('') + '</div>'
          : '') +
        '</div>' +
        '<div class="repo-intro-box">' +
          '<h3>⚡ 快速信息</h3>' +
          '<div class="detail-stats" style="margin:10px 0 0;padding:0;border:none">' +
            '<div class="detail-stat"><span class="detail-stat-value">' + formatNumber(data.stargazers_count) + '</span><span class="detail-stat-label">Stars</span></div>' +
            '<div class="detail-stat"><span class="detail-stat-value">' + formatNumber(data.forks_count) + '</span><span class="detail-stat-label">Forks</span></div>' +
            '<div class="detail-stat"><span class="detail-stat-value">' + (data.releases_count || 0) + '</span><span class="detail-stat-label">Releases</span></div>' +
            '<div class="detail-stat"><span class="detail-stat-value">' + (data.contributors_count || 0) + '</span><span class="detail-stat-label">贡献者</span></div>' +
            '<div class="detail-stat"><span class="detail-stat-value">' + formatNumber(data.open_issues_count) + '</span><span class="detail-stat-label">Issues</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="repo-intro-box">' +
          '<h3>📋 基础信息</h3>' +
          '<div class="detail-meta" style="margin-top:8px">' +
            (data.language ? '<span class="detail-meta-item"><span class="language-dot" style="background:' + langColor + '"></span>' + escapeHtml(data.language) + '</span>' : '') +
            (data.license ? '<span class="detail-meta-item">许可: ' + escapeHtml(data.license.spdx_id || data.license.key) + '</span>' : '<span class="detail-meta-item">无许可协议</span>') +
            '<span class="detail-meta-item">创建于 ' + new Date(data.created_at).toLocaleDateString('zh-CN') + '</span>' +
            '<span class="detail-meta-item">更新于 ' + formatTimeAgo(new Date(data.updated_at)) + '</span>' +
            '<span class="detail-meta-item">分支: ' + escapeHtml(data.default_branch) + '</span>' +
            (data.latest_release ? '<span class="detail-meta-item">最新版: ' + escapeHtml(data.latest_release.tag_name) + '</span>' : '') +
            '<span class="detail-meta-item">大小: ' + (data.size ? (data.size / 1024).toFixed(0) + ' KB' : '未知') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Tab: 统计 (Stats)
      '<div class="tab-content" data-tab-content="stats">' +
        '<div class="detail-stats" style="margin:0 0 14px">' +
          '<div class="detail-stat"><span class="detail-stat-value">' + formatNumber(data.stargazers_count) + '</span><span class="detail-stat-label">Stars</span></div>' +
          '<div class="detail-stat"><span class="detail-stat-value">' + formatNumber(data.forks_count) + '</span><span class="detail-stat-label">Forks</span></div>' +
          '<div class="detail-stat"><span class="detail-stat-value">' + formatNumber(data.open_issues_count) + '</span><span class="detail-stat-label">Open Issues</span></div>' +
          '<div class="detail-stat"><span class="detail-stat-value">' + formatNumber(data.watchers_count) + '</span><span class="detail-stat-label">Watchers</span></div>' +
          '<div class="detail-stat"><span class="detail-stat-value">' + formatNumber(data.subscribers_count) + '</span><span class="detail-stat-label">订阅者</span></div>' +
          '<div class="detail-stat"><span class="detail-stat-value">' + formatNumber(data.network_count) + '</span><span class="detail-stat-label">Network</span></div>' +
        '</div>' +
        '<div class="repo-intro-box">' +
          '<h3>📊 项目规模</h3>' +
          '<div style="display:flex;gap:24px;flex-wrap:wrap;font-size:0.85rem">' +
            '<div><span style="color:var(--text-muted)">贡献者</span> <strong>' + (data.contributors_count || '未知') + '</strong></div>' +
            '<div><span style="color:var(--text-muted)">发布版本</span> <strong>' + (data.releases_count || 0) + '</strong></div>' +
            '<div><span style="color:var(--text-muted)">仓库大小</span> <strong>' + (data.size ? (data.size / 1024).toFixed(0) + ' KB' : '未知') + '</strong></div>' +
            '<div><span style="color:var(--text-muted)">项目周期</span> <strong>' + Math.floor((new Date() - new Date(data.created_at)) / 86400000 / 30) + ' 个月</strong></div>' +
            '<div><span style="color:var(--text-muted)">最后推送</span> <strong>' + formatTimeAgo(new Date(data.pushed_at)) + '</strong></div>' +
          '</div>' +
        '</div>' +
        (data.has_issues !== undefined ? '<div class="repo-intro-box">' +
          '<h3>🔧 功能开关</h3>' +
          '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:0.82rem">' +
            '<span>' + (data.has_issues ? '✅' : '❌') + ' Issues</span>' +
            '<span>' + (data.has_projects ? '✅' : '❌') + ' Projects</span>' +
            '<span>' + (data.has_wiki ? '✅' : '❌') + ' Wiki</span>' +
            '<span>' + (data.has_pages ? '✅' : '❌') + ' Pages</span>' +
            '<span>' + (data.has_discussions ? '✅' : '❌') + ' Discussions</span>' +
          '</div>' +
        '</div>' : '') +
        langBar + langLegend +
      '</div>' +

      // Tab: README
      '<div class="tab-content" data-tab-content="readme">' +
        (data.readme
          ? '<div class="markdown-body">' + readmeHtml + '</div>' +
            (data.readme_truncated ? '<p class="text-muted" style="margin-top:8px">⚠️ README 已截断（前15000字符）</p>' : '')
          : '<div class="repo-intro-box"><p class="text-muted">该仓库没有 README 文件</p></div>') +
      '</div>' +

      // Tab: 测评 (Evaluation)
      '<div class="tab-content" data-tab-content="eval">' +
        '<div class="eval-overall">' +
          '<div class="eval-score-circle" style="color:' + (evalResult.overall >= 70 ? 'var(--green)' : evalResult.overall >= 45 ? 'var(--orange)' : 'var(--red)') + '">' +
            '<span class="eval-score-number">' + evalResult.overall + '</span>' +
          '</div>' +
          '<div class="eval-overall-info">' +
            '<h3>实用性综合评分</h3>' +
            '<p>基于代码健康度、社区活跃度、文档质量、维护频率、成熟度等维度综合计算</p>' +
            '<span class="eval-grade" style="background:' + (evalResult.grade.cls === 'high' ? 'var(--green-bg)' : evalResult.grade.cls === 'medium' ? 'var(--orange-bg)' : 'var(--red-bg)') + ';color:' + (evalResult.grade.cls === 'high' ? 'var(--green)' : evalResult.grade.cls === 'medium' ? 'var(--orange)' : 'var(--red)') + '">' + evalResult.grade.text + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="eval-dimensions">' +
          evalResult.dimensions.map(function (d) {
            return '<div class="eval-dim">' +
              '<div class="eval-dim-header">' +
                '<span class="eval-dim-name">' + d.icon + ' ' + d.name + ' <span style="font-size:0.7rem;color:var(--text-muted);font-weight:400">' + d.desc + '</span></span>' +
                '<span class="eval-dim-score">' + d.score + '/100</span>' +
              '</div>' +
              '<div class="eval-progress">' +
                '<div class="eval-progress-fill ' + (d.score >= 70 ? 'high' : d.score >= 40 ? 'medium' : 'low') + '" style="width:' + d.score + '%"></div>' +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
        // User notes
        '<div class="user-notes">' +
          '<h3>✏️ 我的笔记与评价</h3>' +
          '<textarea id="userNotesArea" placeholder="记录你对这个项目的使用体验、优缺点、适用场景等...">' + escapeHtml(userNotes) + '</textarea>' +
          '<div class="notes-actions">' +
            '<span class="notes-saved" id="notesSaved">✅ 已保存</span>' +
            '<button class="btn btn-sm btn-primary" id="saveNoteBtn">保存笔记</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Tab switching
    var tabs = modalBody.querySelectorAll('.modal-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        modalBody.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
        var target = modalBody.querySelector('[data-tab-content="' + tab.dataset.tab + '"]');
        if (target) target.classList.add('active');
      });
    });

    // Save note
    var saveNoteBtn = modalBody.querySelector('#saveNoteBtn');
    var notesArea = modalBody.querySelector('#userNotesArea');
    var notesSaved = modalBody.querySelector('#notesSaved');
    if (saveNoteBtn) {
      saveNoteBtn.addEventListener('click', function () {
        saveUserNote(fullName, notesArea.value);
        notesSaved.classList.add('visible');
        setTimeout(function () { notesSaved.classList.remove('visible'); }, 2000);
      });
    }
  }

  // User notes localStorage
  function getUserNote(fullName) {
    try {
      var notes = JSON.parse(localStorage.getItem('repoNotes') || '{}');
      return notes[fullName] || '';
    } catch (e) { return ''; }
  }

  function saveUserNote(fullName, content) {
    try {
      var notes = JSON.parse(localStorage.getItem('repoNotes') || '{}');
      if (content.trim()) {
        notes[fullName] = content;
      } else {
        delete notes[fullName];
      }
      localStorage.setItem('repoNotes', JSON.stringify(notes));
    } catch (e) {}
  }

  function closeDetail() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  modalClose.addEventListener('click', closeDetail);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeDetail(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeDetail();
  });

  // ═══════════════════════════════════════════════════════════
  // Pagination
  // ═══════════════════════════════════════════════════════════
  function updatePagination() {
    pageInfo.textContent = '第 ' + currentPage + ' / ' + totalPages + ' 页';
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
  }

  function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    doSearch(currentQuery);
    window.scrollTo({ top: resultsGrid.offsetTop - 80, behavior: 'smooth' });
  }

  // ═══════════════════════════════════════════════════════════
  // Search orchestrator
  // ═══════════════════════════════════════════════════════════
  function doSearch(query) {
    var q = buildQuery(query);
    if (!q) return;

    currentQuery = query;
    showSkeleton(true);
    errorBox.style.display = 'none';
    emptyState.style.display = 'none';
    resultsGrid.innerHTML = '';
    pagination.style.display = 'none';
    cacheHit.style.display = 'none';

    searchRepos(query, currentPage)
      .then(function (data) {
        showSkeleton(false);
        if (data) renderResults(data);
      })
      .catch(function (err) {
        showSkeleton(false);
        resultsGrid.innerHTML = '';
        emptyState.style.display = 'none';
        if (err.name === 'AbortError') {
          errorMsg.textContent = '请求超时，请检查网络后重试';
        } else {
          errorMsg.textContent = err.message;
        }
        errorBox.style.display = '';
        resultCount.textContent = '';
        rateLimit.textContent = '';
      });
  }

  function showSkeleton(show) {
    skeleton.style.display = show ? 'grid' : 'none';
  }

  // ═══════════════════════════════════════════════════════════
  // Retry
  // ═══════════════════════════════════════════════════════════
  retryBtn.addEventListener('click', function () {
    if (currentQuery) doSearch(currentQuery);
  });

  // ═══════════════════════════════════════════════════════════
  // UI helpers
  // ═══════════════════════════════════════════════════════════
  function formatNumber(n) {
    if (!n && n !== 0) return '0';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function formatTimeAgo(date) {
    var diff = Date.now() - date.getTime();
    var minutes = Math.floor(diff / 60000);
    if (minutes < 60) return minutes <= 1 ? '刚刚' : minutes + ' 分钟前';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' 小时前';
    var days = Math.floor(hours / 24);
    if (days < 30) return days + ' 天前';
    if (days < 365) return Math.floor(days / 30) + ' 个月前';
    return Math.floor(days / 365) + ' 年前';
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════
  // Event listeners
  // ═══════════════════════════════════════════════════════════

  // Search button
  searchBtn.addEventListener('click', function () {
    hideSuggestions();
    currentPage = 1;
    doSearch(searchInput.value);
  });

  // Enter key
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      hideSuggestions();
      currentPage = 1;
      doSearch(searchInput.value);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      var items = suggestions.querySelectorAll('.suggestion-item');
      if (items.length) {
        suggestionIndex = Math.min(suggestionIndex + 1, items.length - 1);
        items.forEach(function (item, i) { item.classList.toggle('active', i === suggestionIndex); });
      }
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      var items = suggestions.querySelectorAll('.suggestion-item');
      if (items.length) {
        suggestionIndex = Math.max(suggestionIndex - 1, -1);
        items.forEach(function (item, i) { item.classList.toggle('active', i === suggestionIndex); });
      }
    }
    if (e.key === 'Escape') {
      hideSuggestions();
    }
  });

  // Debounced input
  searchInput.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    showSuggestions();
    // Auto-search after 400ms of no typing
    debounceTimer = setTimeout(function () {
      if (searchInput.value.trim()) {
        hideSuggestions();
        currentPage = 1;
        doSearch(searchInput.value);
      }
    }, 400);
  });

  // Focus to show suggestions
  searchInput.addEventListener('focus', function () {
    if (!searchInput.value.trim() || searchInput.value === 'stars:>1000') {
      showSuggestions();
    }
  });

  // Click suggestion
  suggestions.addEventListener('click', function (e) {
    var item = e.target.closest('.suggestion-item');
    if (item) selectSuggestion(item.dataset.query);
  });

  // Click outside suggestions
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#searchBarWrapper')) hideSuggestions();
  });

  // Quick topic chips
  document.querySelectorAll('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      searchInput.value = this.dataset.query;
      languageFilter.value = '';
      currentPage = 1;
      hideSuggestions();
      doSearch(this.dataset.query);
    });
  });

  // Filters change
  [languageFilter, sortFilter, minStars].forEach(function (el) {
    el.addEventListener('change', function () {
      if (searchInput.value.trim()) {
        currentPage = 1;
        doSearch(searchInput.value);
      }
    });
  });

  // Pagination
  prevBtn.addEventListener('click', function () { goToPage(currentPage - 1); });
  nextBtn.addEventListener('click', function () { goToPage(currentPage + 1); });

  // Logo click to reset
  logoHome.addEventListener('click', function () {
    switchView('home');
    searchInput.value = '';
    currentPage = 1;
    resultsGrid.innerHTML = '';
    pagination.style.display = 'none';
    errorBox.style.display = 'none';
    skeleton.style.display = 'none';
    statsBar.style.display = 'none';
    emptyState.style.display = 'none';
    resultCount.textContent = '输入关键词开始探索开源世界';
    rateLimit.textContent = '';
    showHero();
    showDiscover();
  });

  // ═══════════════════════════════════════════════════════════
  // View switching (Home ↔ Collections)
  // ═══════════════════════════════════════════════════════════
  function switchView(name) {
    if (name === 'home') {
      viewHome.classList.add('active');
      viewCollections.classList.remove('active');
    } else {
      viewHome.classList.remove('active');
      viewCollections.classList.add('active');
      renderCollections();
    }
    navLinks.forEach(function (link) {
      link.classList.toggle('active', link.dataset.view === name);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navLinks.forEach(function (link) {
    link.addEventListener('click', function () { switchView(link.dataset.view); });
  });

  // From "返回发现页" button inside empty collections
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-view]');
    if (btn && btn.tagName === 'BUTTON' && btn.dataset.view === 'home' && !btn.classList.contains('nav-link')) {
      switchView('home');
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Discover sections (categories + recent releases)
  // ═══════════════════════════════════════════════════════════
  var categoryQueries = {
    frontend: { q: 'topic:frontend', label: '前端框架', stars: 5000 },
    ai: { q: 'topic:machine-learning', label: 'AI / 机器学习', stars: 5000 },
    devtools: { q: 'topic:developer-tools', label: '开发工具', stars: 2000 },
    backend: { q: 'topic:backend', label: '后端 / 微服务', stars: 2000 },
    database: { q: 'topic:database', label: '数据库', stars: 2000 },
    learning: { q: 'topic:learning', label: '学习资源', stars: 5000 },
    awesome: { q: 'topic:awesome', label: 'Awesome', stars: 10000 },
    game: { q: 'topic:game-engine OR topic:gamedev', label: '游戏 / 引擎', stars: 1000 },
  };

  var categoryCache = {};
  var currentCategory = 'frontend';
  var recentCache = null;

  function showDiscover() {
    if (categoriesSection) categoriesSection.style.display = '';
    if (recentSection) recentSection.style.display = '';
  }

  function hideDiscover() {
    if (categoriesSection) categoriesSection.style.display = 'none';
    if (recentSection) recentSection.style.display = 'none';
  }

  function renderMiniCard(repo) {
    var saved = isBookmarked(repo.full_name);
    var langColor = langColors[repo.language] || '#8b949e';
    return '<article class="mini-card" data-owner="' + escapeHtml(repo.owner.login) + '" data-repo="' + escapeHtml(repo.name) + '">' +
      '<button class="mini-card-save' + (saved ? ' saved' : '') + '" data-fullname="' + escapeHtml(repo.full_name) + '" title="' + (saved ? '取消收藏' : '收藏') + '">' + (saved ? '✓' : '+') + '</button>' +
      '<div class="mini-card-header">' +
        '<span class="mini-card-name">' + escapeHtml(repo.full_name) + '</span>' +
      '</div>' +
      '<p class="mini-card-desc">' + escapeHtml(repo.description || '暂无描述') + '</p>' +
      '<div class="mini-card-footer">' +
        (repo.language ? '<span class="mini-card-stat"><span class="language-dot" style="background:' + langColor + ';width:8px;height:8px"></span>' + escapeHtml(repo.language) + '</span>' : '') +
        '<span class="mini-card-stat">⭐ ' + formatNumber(repo.stargazers_count) + '</span>' +
        '<span class="mini-card-stat">🍴 ' + formatNumber(repo.forks_count) + '</span>' +
      '</div>' +
    '</article>';
  }

  function bindMiniCardEvents(container, items) {
    container.querySelectorAll('.mini-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        openDetail(card.dataset.owner, card.dataset.repo);
      });
    });
    container.querySelectorAll('.mini-card-save').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var fullName = btn.dataset.fullname;
        var repo = items.find(function (r) { return r.full_name === fullName; });
        if (!repo) return;
        var nowSaved = toggleBookmark(repo);
        btn.textContent = nowSaved ? '✓' : '+';
        btn.title = nowSaved ? '取消收藏' : '收藏';
        btn.classList.toggle('saved', nowSaved);
        showToast(nowSaved ? '已添加到收藏夹 ✨' : '已从收藏夹移除');
        updateBookmarkBadge();
      });
    });
  }

  function loadCategory(catKey) {
    var cfg = categoryQueries[catKey];
    if (!cfg) return;
    currentCategory = catKey;

    if (categoryCache[catKey]) {
      renderCategoryGrid(categoryCache[catKey]);
      return;
    }

    categoryGrid.innerHTML = '<div class="discover-loading">⏳ 加载 ' + cfg.label + ' 中...</div>';
    var q = cfg.q + ' stars:>=' + cfg.stars;
    var params = new URLSearchParams({ q: q, sort: 'stars', order: 'desc', page: 1, per_page: 9 });
    fetch('/api/search?' + params.toString())
      .then(function (resp) { return resp.json().then(function (d) { return { ok: resp.ok, data: d }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.data.error || '加载失败');
        categoryCache[catKey] = r.data.items || [];
        renderCategoryGrid(categoryCache[catKey]);
      })
      .catch(function (err) {
        categoryGrid.innerHTML = '<div class="discover-loading" style="color:var(--red)">加载失败: ' + escapeHtml(err.message) + '</div>';
      });
  }

  function renderCategoryGrid(items) {
    if (!items || items.length === 0) {
      categoryGrid.innerHTML = '<div class="discover-loading">暂无项目</div>';
      return;
    }
    categoryGrid.innerHTML = items.map(renderMiniCard).join('');
    bindMiniCardEvents(categoryGrid, items);
  }

  function loadRecent() {
    if (recentCache) {
      renderRecentGrid(recentCache);
      return;
    }
    recentGrid.innerHTML = '<div class="discover-loading">⏳ 加载最近热门...</div>';
    // Recently created (within 90 days) with reasonable stars
    var date = new Date();
    date.setDate(date.getDate() - 90);
    var dateStr = date.toISOString().split('T')[0];
    var q = 'created:>' + dateStr + ' stars:>=200';
    var params = new URLSearchParams({ q: q, sort: 'stars', order: 'desc', page: 1, per_page: 9 });
    fetch('/api/search?' + params.toString())
      .then(function (resp) { return resp.json().then(function (d) { return { ok: resp.ok, data: d }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.data.error || '加载失败');
        recentCache = r.data.items || [];
        renderRecentGrid(recentCache);
      })
      .catch(function (err) {
        recentGrid.innerHTML = '<div class="discover-loading" style="color:var(--red)">加载失败: ' + escapeHtml(err.message) + '</div>';
      });
  }

  function renderRecentGrid(items) {
    if (!items || items.length === 0) {
      recentGrid.innerHTML = '<div class="discover-loading">暂无项目</div>';
      return;
    }
    recentGrid.innerHTML = items.map(renderMiniCard).join('');
    bindMiniCardEvents(recentGrid, items);
  }

  // Bind category tabs
  if (categoryTabs) {
    categoryTabs.querySelectorAll('.cat-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        categoryTabs.querySelectorAll('.cat-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        loadCategory(tab.dataset.cat);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Collections (with auto-grouping)
  // ═══════════════════════════════════════════════════════════
  var collectionGroupBy = 'language'; // 'language', 'topic', 'time'
  var collectionFilter = 'all';
  var collectionQuery = '';

  function categorizeBookmark(repo) {
    // Returns array of category keys this repo belongs to
    var topics = repo.topics || [];
    var lang = repo.language || '';
    var groups = [];

    if (topics.indexOf('awesome') >= 0 || (repo.full_name && repo.full_name.toLowerCase().indexOf('awesome') >= 0)) {
      groups.push({ key: 'awesome', label: '⭐ Awesome 列表', priority: 1 });
    }
    if (topics.some(function (t) { return ['react','vue','angular','svelte','frontend','ui','css','tailwindcss'].indexOf(t) >= 0; })) {
      groups.push({ key: 'frontend', label: '⚛️ 前端', priority: 2 });
    }
    if (topics.some(function (t) { return ['machine-learning','deep-learning','ai','llm','chatgpt','nlp','computer-vision','tensorflow','pytorch'].indexOf(t) >= 0; })) {
      groups.push({ key: 'ai', label: '🧠 AI / ML', priority: 2 });
    }
    if (topics.some(function (t) { return ['cli','devtools','developer-tools','build-tool','vscode','editor'].indexOf(t) >= 0; })) {
      groups.push({ key: 'devtools', label: '🛠 开发工具', priority: 3 });
    }
    if (topics.some(function (t) { return ['database','db','sql','nosql','redis','mongodb','postgresql'].indexOf(t) >= 0; })) {
      groups.push({ key: 'database', label: '💾 数据库', priority: 3 });
    }
    if (topics.some(function (t) { return ['learning','tutorial','book','course','interview'].indexOf(t) >= 0; })) {
      groups.push({ key: 'learning', label: '📖 学习资源', priority: 3 });
    }
    if (topics.some(function (t) { return ['game','gamedev','game-engine'].indexOf(t) >= 0; })) {
      groups.push({ key: 'game', label: '🎮 游戏', priority: 3 });
    }
    // Fallback: by language
    if (groups.length === 0) {
      if (lang) {
        groups.push({ key: 'lang-' + lang.toLowerCase(), label: '💻 ' + lang, priority: 5 });
      } else {
        groups.push({ key: 'other', label: '📦 其他', priority: 9 });
      }
    }
    return groups;
  }

  function renderCollections() {
    var bookmarks = getBookmarks();

    if (bookmarks.length === 0) {
      collectionsEmpty.style.display = '';
      collectionsGroups.innerHTML = '';
      collectionFilters.innerHTML = '';
      collectionsSummary.textContent = '还没有收藏，去发现页找点感兴趣的项目吧';
      return;
    }

    collectionsEmpty.style.display = 'none';

    // Filter by search query
    var filtered = bookmarks;
    if (collectionQuery) {
      var qLow = collectionQuery.toLowerCase();
      filtered = bookmarks.filter(function (b) {
        return b.full_name.toLowerCase().indexOf(qLow) >= 0 ||
               (b.description || '').toLowerCase().indexOf(qLow) >= 0 ||
               (b.topics || []).some(function (t) { return t.indexOf(qLow) >= 0; });
      });
    }

    // Group by category
    var groupMap = {}; // key -> { label, items: [] }
    filtered.forEach(function (repo) {
      var cats = categorizeBookmark(repo);
      cats.forEach(function (cat) {
        if (!groupMap[cat.key]) {
          groupMap[cat.key] = { label: cat.label, priority: cat.priority, items: [] };
        }
        // Avoid duplicates (a repo with multiple matching cats only goes in the highest priority one)
        if (!groupMap[cat.key].items.some(function (r) { return r.full_name === repo.full_name; })) {
          groupMap[cat.key].items.push(repo);
        }
      });
    });

    var groups = Object.entries(groupMap).map(function (entry) {
      return Object.assign({ key: entry[0] }, entry[1]);
    }).sort(function (a, b) {
      return a.priority - b.priority || b.items.length - a.items.length;
    });

    // Build filter chips
    var filtersHtml = '<button class="coll-filter' + (collectionFilter === 'all' ? ' active' : '') + '" data-filter="all">全部 <span class="coll-filter-count">' + bookmarks.length + '</span></button>';
    groups.forEach(function (g) {
      filtersHtml += '<button class="coll-filter' + (collectionFilter === g.key ? ' active' : '') + '" data-filter="' + escapeHtml(g.key) + '">' + g.label + ' <span class="coll-filter-count">' + g.items.length + '</span></button>';
    });
    collectionFilters.innerHTML = filtersHtml;
    collectionFilters.querySelectorAll('.coll-filter').forEach(function (btn) {
      btn.addEventListener('click', function () {
        collectionFilter = btn.dataset.filter;
        renderCollections();
      });
    });

    // Filter groups by selected filter
    var visibleGroups = collectionFilter === 'all' ? groups : groups.filter(function (g) { return g.key === collectionFilter; });

    // Apply sorting within each group: by saved time desc
    visibleGroups.forEach(function (g) {
      g.items.sort(function (a, b) {
        return new Date(b.savedAt || 0) - new Date(a.savedAt || 0);
      });
    });

    collectionsSummary.textContent = '共收藏 ' + bookmarks.length + ' 个仓库 · 自动分为 ' + groups.length + ' 个主题';

    if (visibleGroups.length === 0 || visibleGroups.every(function (g) { return g.items.length === 0; })) {
      collectionsGroups.innerHTML = '<div class="discover-loading">该分类下暂无收藏</div>';
      return;
    }

    collectionsGroups.innerHTML = visibleGroups.map(function (g) {
      return '<div class="collection-group">' +
        '<div class="collection-group-header">' +
          '<span class="collection-group-name">' + g.label + '</span>' +
          '<span class="collection-group-count">' + g.items.length + ' 个项目</span>' +
        '</div>' +
        '<div class="recent-grid">' + g.items.map(renderMiniCard).join('') + '</div>' +
      '</div>';
    }).join('');

    // Bind events for all rendered cards
    collectionsGroups.querySelectorAll('.collection-group').forEach(function (groupEl, idx) {
      var items = visibleGroups[idx].items;
      bindMiniCardEvents(groupEl, items);
    });
  }

  if (collectionSearch) {
    collectionSearch.addEventListener('input', function () {
      collectionQuery = this.value.trim();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(renderCollections, 200);
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      var bookmarks = getBookmarks();
      if (bookmarks.length === 0) {
        showToast('没有收藏可导出');
        return;
      }
      var md = '# 我的 GitHub 收藏夹\n\n导出于 ' + new Date().toLocaleString('zh-CN') + '\n\n';
      var groupMap = {};
      bookmarks.forEach(function (repo) {
        var cats = categorizeBookmark(repo);
        cats.forEach(function (cat) {
          if (!groupMap[cat.label]) groupMap[cat.label] = [];
          if (!groupMap[cat.label].some(function (r) { return r.full_name === repo.full_name; })) {
            groupMap[cat.label].push(repo);
          }
        });
      });
      Object.entries(groupMap).forEach(function (entry) {
        md += '## ' + entry[0] + '\n\n';
        entry[1].forEach(function (r) {
          md += '- [' + r.full_name + '](' + r.html_url + ') — ' + (r.description || '') + ' (⭐ ' + r.stargazers_count + ')\n';
        });
        md += '\n';
      });
      var blob = new Blob([md], { type: 'text/markdown' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'github-bookmarks-' + new Date().toISOString().split('T')[0] + '.md';
      a.click();
      URL.revokeObjectURL(url);
      showToast('收藏已导出 📤');
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Toast & UI helpers
  // ═══════════════════════════════════════════════════════════
  var toastTimer = null;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('visible'); }, 2200);
  }

  function updateBookmarkBadge() {
    if (!bookmarkBadge) return;
    var count = getBookmarks().length;
    bookmarkBadge.textContent = count;
    bookmarkBadge.style.display = count > 0 ? '' : 'none';
  }

  // Back-to-top
  if (backTop) {
    window.addEventListener('scroll', function () {
      backTop.classList.toggle('visible', window.scrollY > 400);
    });
    backTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Initial load: discover home
  // ═══════════════════════════════════════════════════════════
  updateBookmarkBadge();
  emptyState.style.display = 'none';
  statsBar.style.display = 'none';
  loadCategory('frontend');
  loadRecent();
})();
