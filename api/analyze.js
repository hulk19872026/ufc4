// api/analyze.js — Vercel Serverless Function
// Standard CommonJS format, no Edge runtime

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Debug: log all env var keys (not values) to Vercel logs
  const envKeys = Object.keys(process.env).filter(k => k.includes('ANTHROPIC'));
  console.log('ANTHROPIC env keys found:', envKeys);

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is undefined. Available keys:', Object.keys(process.env).slice(0, 20));
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not set in this deployment. Try: Vercel Dashboard → Settings → Environment Variables → confirm ANTHROPIC_API_KEY exists → Redeploy from scratch (not just a retry).'
    });
  }

  if (!apiKey.startsWith('sk-ant-')) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY looks invalid — it should start with sk-ant-. Check the value in Vercel Environment Variables.'
    });
  }

  const { messages } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request — messages array required' });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        stream: true,
        messages: messages,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error('Anthropic API error:', upstream.status, errText);
      return res.status(upstream.status).json({
        error: 'Anthropic API returned ' + upstream.status + ': ' + errText
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }

    res.end();
  } catch (err) {
    console.error('Handler error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Server error: ' + err.message });
    }
  }
};
