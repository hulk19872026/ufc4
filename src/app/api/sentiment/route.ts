import { NextResponse } from 'next/server';
import type { SentimentSummary, SentimentTweet } from '@/lib/types';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const f1 = searchParams.get('f1') ?? '';
  const f2 = searchParams.get('f2') ?? '';

  const bearer = process.env.TWITTER_BEARER_TOKEN;
  if (!bearer) {
    return NextResponse.json(mockSentiment(f1, f2));
  }

  try {
    const query = encodeURIComponent(
      `(${f1.split(' ').slice(-1)[0]} OR ${f2.split(' ').slice(-1)[0]}) UFC -is:retweet lang:en`
    );
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=20&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=name,username`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearer}` },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      console.error('Twitter API error:', res.status);
      return NextResponse.json(mockSentiment(f1, f2));
    }

    const data = await res.json();
    const tweets: SentimentTweet[] = [];
    const users = new Map((data.includes?.users ?? []).map((u: any) => [u.id, u]));

    let f1Count = 0, f2Count = 0, neutralCount = 0;
    const f1Last = f1.split(' ').slice(-1)[0].toLowerCase();
    const f2Last = f2.split(' ').slice(-1)[0].toLowerCase();

    for (const tweet of data.data ?? []) {
      const user = users.get(tweet.author_id) as any;
      const text = tweet.text.toLowerCase();
      const mentionsF1 = text.includes(f1Last) || text.includes(f1.toLowerCase());
      const mentionsF2 = text.includes(f2Last) || text.includes(f2.toLowerCase());
      const positiveWords = ['wins', 'win', 'ko', 'finish', 'dominate', 'best', 'better', 'elite', 'going to', 'will'];
      const positive1 = mentionsF1 && positiveWords.some((w) => text.includes(w));
      const positive2 = mentionsF2 && positiveWords.some((w) => text.includes(w));

      let sentiment: SentimentTweet['sentiment'] = 'neutral';
      if (positive1 && !positive2) { sentiment = 'fighter1'; f1Count++; }
      else if (positive2 && !positive1) { sentiment = 'fighter2'; f2Count++; }
      else { sentiment = 'neutral'; neutralCount++; }

      tweets.push({
        id: tweet.id,
        text: tweet.text,
        authorName: user?.name ?? 'UFC Fan',
        authorHandle: user?.username ?? 'ufcfan',
        createdAt: tweet.created_at,
        likeCount: tweet.public_metrics?.like_count ?? 0,
        sentiment,
      });
    }

    const total = f1Count + f2Count + neutralCount || 1;
    const summary: SentimentSummary = {
      fighter1Pct: Math.round((f1Count / total) * 100),
      fighter2Pct: Math.round((f2Count / total) * 100),
      neutralPct: Math.round((neutralCount / total) * 100),
      totalTweets: tweets.length,
      tweets: tweets.slice(0, 8),
      updatedAt: new Date().toISOString(),
      isLive: true,
    };

    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('Sentiment error:', err.message);
    return NextResponse.json(mockSentiment(f1, f2));
  }
}

// Mock sentiment when no Twitter API key is configured
function mockSentiment(f1: string, f2: string): SentimentSummary {
  const f1Pct = 40 + Math.round(Math.random() * 30);
  const f2Pct = 100 - f1Pct - 8;
  const tweets: SentimentTweet[] = [
    {
      id: '1', text: `${f1} is looking sharp in camp. Going to be a tough fight. #UFC`,
      authorName: 'MMA Analyst', authorHandle: 'mmaanalyst', createdAt: new Date().toISOString(),
      likeCount: 142, sentiment: 'fighter1',
    },
    {
      id: '2', text: `Don't sleep on ${f2}! That reach advantage is huge. #UFC`,
      authorName: 'FightFan', authorHandle: 'fightfan', createdAt: new Date().toISOString(),
      likeCount: 87, sentiment: 'fighter2',
    },
    {
      id: '3', text: `Can't wait for this fight. Both fighters are elite. #UFCcard`,
      authorName: 'UFC Enthusiast', authorHandle: 'ufcenth', createdAt: new Date().toISOString(),
      likeCount: 203, sentiment: 'neutral',
    },
    {
      id: '4', text: `${f1} by KO round 2. The power is too much. #UFC`,
      authorName: 'PredictionKing', authorHandle: 'predking', createdAt: new Date().toISOString(),
      likeCount: 55, sentiment: 'fighter1',
    },
    {
      id: '5', text: `${f2} training camp looked incredible. Taking this one. #UFC`,
      authorName: 'CageAnalyst', authorHandle: 'cageanalyst', createdAt: new Date().toISOString(),
      likeCount: 98, sentiment: 'fighter2',
    },
  ];
  return {
    fighter1Pct: f1Pct,
    fighter2Pct: f2Pct,
    neutralPct: 8,
    totalTweets: tweets.length,
    tweets,
    updatedAt: new Date().toISOString(),
    isLive: false,
  };
}
