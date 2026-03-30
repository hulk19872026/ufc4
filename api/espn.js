// api/espn.js — Multi-route ESPN proxy for UFCStats app
// Routes:
//   /api/espn?type=scoreboard          → site.api.espn.com scoreboard (current event)
//   /api/espn?type=athlete&id=XXXX     → sports.core.api.espn.com athlete profile + stats
//   /api/espn?type=event&id=XXXX       → sports.core.api.espn.com full event with all competitions
//   /api/espn?type=competition&eid=X&cid=Y → competition detail with live stats

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-cache, no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const type = req.query.type || 'scoreboard';
  const id   = req.query.id   || '';
  const eid  = req.query.eid  || '';
  const cid  = req.query.cid  || '';

  const BASE_SITE   = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc';
  const BASE_CORE   = 'https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc';

  let url = '';

  if (type === 'scoreboard') {
    url = `${BASE_SITE}/scoreboard`;
  } else if (type === 'athlete' && id) {
    // Returns athlete profile including stats (slpm, sacc, sdef, tdavg, tdacc, tddef, subavg)
    url = `${BASE_CORE}/athletes/${id}?lang=en&region=us`;
  } else if (type === 'athlete_stats' && id) {
    url = `${BASE_CORE}/athletes/${id}/statistics`;
  } else if (type === 'event' && id) {
    url = `${BASE_CORE}/events/${id}?lang=en&region=us`;
  } else if (type === 'competition' && eid && cid) {
    url = `${BASE_CORE}/events/${eid}/competitions/${cid}?lang=en&region=us`;
  } else if (type === 'competition_stats' && eid && cid) {
    // Per-round stats and significant strikes for a live/completed fight
    url = `${BASE_CORE}/events/${eid}/competitions/${cid}/statistics`;
  } else {
    return res.status(400).json({ error: 'Unknown type: ' + type });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; UFCStatsApp/2.0)',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `ESPN returned ${response.status}`,
        url: url
      });
    }

    const data = await response.json();
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(data);

  } catch (err) {
    console.error('ESPN proxy error:', err.message, 'url:', url);
    return res.status(500).json({ error: err.message, url: url });
  }
};
