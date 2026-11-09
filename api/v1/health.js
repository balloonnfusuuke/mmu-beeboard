/* GET /api/v1/health — liveness probe for the BeeBoard API.
   Vercel maps api/v1/health.js to /api/v1/health with zero config, and keeps
   serving the static pages at the repo root as files, so no vercel.json is needed.
   Plain Node request/response API only: no dependencies, no environment variables. */
'use strict';

module.exports = function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ ok: true }));
};
