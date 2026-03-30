// api/espn.js — Vercel serverless proxy for ESPN UFC scoreboard
// Bypasses browser CORS restriction

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-cache');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; UFCStatsApp/1.0)',
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `ESPN returned ${response.status}` });
    }

    const data = await response.json();
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(data);
  } catch (err) {
    console.error('ESPN proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
};
