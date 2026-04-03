'use client';

import { useState, useEffect } from 'react';
import type { SentimentSummary } from '@/lib/types';

interface Props {
  f1Name: string;
  f2Name: string;
  fightId: string;
}

export default function SentimentPanel({ f1Name, f2Name, fightId }: Props) {
  const [data, setData] = useState<SentimentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sentiment?f1=${encodeURIComponent(f1Name)}&f2=${encodeURIComponent(f2Name)}`);
      const json = await res.json();
      setData(json);
    } catch {}
    setLoading(false);
  };

  return (
    <div className="bg-[#14141f] border border-white/[0.07] rounded-xl overflow-hidden">
      <button
        onClick={() => { setExpanded(!expanded); if (!data && !loading) load(); }}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">𝕏</span>
          <div className="text-left">
            <div className="text-[10px] font-bold tracking-widest uppercase text-white/40">X.com Sentiment</div>
            <div className="text-[10px] text-white/25">What fans are saying about this fight</div>
          </div>
        </div>
        <span className="text-white/30 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 analysis-enter">
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg shimmer" />
              ))}
            </div>
          )}

          {data && !loading && (
            <>
              {/* Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="font-semibold text-blue-400">{f1Name.split(' ')[0]} {data.fighter1Pct}%</span>
                  <span className="text-white/30">{data.neutralPct}% Neutral</span>
                  <span className="font-semibold text-red-400">{data.fighter2Pct}% {f2Name.split(' ')[0]}</span>
                </div>
                <div className="flex rounded-full overflow-hidden h-2">
                  <div className="bg-blue-500" style={{ width: `${data.fighter1Pct}%` }} />
                  <div className="bg-white/10" style={{ width: `${data.neutralPct}%` }} />
                  <div className="bg-red-500" style={{ width: `${data.fighter2Pct}%` }} />
                </div>
                <p className="text-[10px] text-white/25 mt-1">{data.totalTweets} posts analyzed</p>
              </div>

              {/* Tweets */}
              <div className="space-y-2">
                {data.tweets.map((tweet) => (
                  <div
                    key={tweet.id}
                    className={`p-3 rounded-lg border text-xs ${
                      tweet.sentiment === 'fighter1'
                        ? 'border-blue-500/20 bg-blue-500/5'
                        : tweet.sentiment === 'fighter2'
                        ? 'border-red-500/20 bg-red-500/5'
                        : 'border-white/[0.06] bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-white/70">{tweet.authorName}</span>
                        <span className="text-white/30">@{tweet.authorHandle}</span>
                      </div>
                      <div className="flex items-center gap-1 text-white/25">
                        <span>♥</span>
                        <span>{tweet.likeCount}</span>
                      </div>
                    </div>
                    <p className="text-white/60 leading-relaxed">{tweet.text}</p>
                    {tweet.sentiment !== 'neutral' && (
                      <span className={`mt-1.5 inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        tweet.sentiment === 'fighter1' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {tweet.sentiment === 'fighter1' ? f1Name.split(' ')[0] : f2Name.split(' ')[0]}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-[9px] text-white/20 mt-3">
                Updated {new Date(data.updatedAt).toLocaleTimeString()}
                {!process.env.TWITTER_BEARER_TOKEN && ' · Add TWITTER_BEARER_TOKEN to Vercel env for live data'}
              </p>

              <button
                onClick={load}
                className="mt-2 text-[10px] px-3 py-1.5 rounded-lg border border-white/10 text-white/30 hover:text-white/50 transition-colors"
              >
                ↺ Refresh
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
