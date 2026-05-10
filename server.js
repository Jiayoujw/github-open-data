// Local dev server: wraps the same handlers used by Vercel serverless functions
// so behavior is identical between local and production.

const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const searchHandler = require('./api/search');
const repoHandler = require('./api/repo/[owner]/[name]');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.static(path.join(__dirname)));

// Adapter: Express's req.query already matches Vercel's; the handlers work as-is.
app.get('/api/search', (req, res) => searchHandler(req, res));
app.get('/api/repo/:owner/:name', (req, res) => {
  // Vercel handlers read params via req.query; merge route params for compatibility
  const fakeReq = {
    query: { ...req.query, owner: req.params.owner, name: req.params.name },
    headers: req.headers,
    method: req.method,
    url: req.url,
  };
  return repoHandler(fakeReq, res);
});

app.listen(PORT, () => {
  const tok = process.env.GITHUB_ACCESS_TOKEN;
  console.log('Server running at http://localhost:' + PORT);
  console.log('GitHub Token configured:', tok ? 'yes (' + tok.substring(0, 6) + '...)' : 'no (60 req/hr limit)');
});
