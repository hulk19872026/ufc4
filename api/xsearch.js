// api/xsearch.js — Search X.com for UFC fight commentary via DuckDuckGo web search
// Returns text snippets from public X.com posts matching the query.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-cache, no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'No query' });

  const snippets = [];

  // Attempt 1: DuckDuckGo HTML search for site:x.com posts
  try {
    const url = 'https://html.duckduckgo.com/html/?q='
      + encodeURIComponent('site:x.com ' + q)
      + '&df=w';   // past week

    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://duckduckgo.com/'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (r.ok) {
      const html = await r.text();
      // Parse result__snippet anchors
      const re = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      let m;
      while ((m = re.exec(html)) !== null && snippets.length < 8) {
        const text = m[1]
          .replace(/<b>/gi, '').replace(/<\/b>/gi, '')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ').trim();
        if (text.length > 15) snippets.push(text);
      }
    }
  } catch (e) {
    // Network error or timeout — fall through with empty snippets
  }

  // Attempt 2: Try Nitter (open-source Twitter frontend) search as fallback
  if (!snippets.length) {
    const nitterHosts = ['nitter.privacydev.net', 'nitter.poast.org'];
    for (const host of nitterHosts) {
      try {
        const url = 'https://' + host + '/search?q=' + encodeURIComponent(q) + '&f=tweets';
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UFCStatsApp/2.0)' },
          signal: AbortSignal.timeout(4000)
        });
        if (r.ok) {
          const html = await r.text();
          // Parse tweet-content divs
          const re = /class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
          let m;
          while ((m = re.exec(html)) !== null && snippets.length < 6) {
            const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (text.length > 15) snippets.push(text);
          }
          if (snippets.length) break;
        }
      } catch (e) { /* try next host */ }
    }
  }

  return res.status(200).json({
    snippets,
    query: q,
    source: snippets.length ? 'web_search' : 'none'
  });
};
