// ─── Fighter ──────────────────────────────────────────────────────────────────
export interface FighterStats {
  slpm: number;         // sig strikes landed per minute
  sacc: number;         // striking accuracy %
  sdef: number;         // striking defense %
  tdavg: number;        // takedowns per 15 min
  tdacc: number;        // takedown accuracy %
  tddef: number;        // takedown defense %
  subavg: number;       // submission attempts per 15 min
  powerHitsPerMin: number; // sig head/body strikes per min (proxy for power output)
}

export interface Fighter {
  id: string;
  espnId?: string;
  name: string;
  nickname?: string;
  rank?: string;
  record: string;          // "25-3-0"
  wins: number;
  losses: number;
  draws: number;
  weightClass: string;
  height?: string;
  reach?: number;          // inches
  stance?: string;
  age?: number;
  nationality?: string;
  hometown?: string;
  imageUrl?: string;
  stats: FighterStats;
  // finish breakdown (wins)
  ko: number;
  sub: number;
  dec: number;
  // first-round finishes
  firstRoundKOs: number;
  // loss breakdown
  koLoss: number;
  subLoss: number;
  decLoss: number;
  // computed / enriched
  winStreak: number;       // current win streak (0 if on loss)
  avgFightTimeMin?: number;
  recentForm?: string;     // "WWWLW"
  style?: string;
  tier?: 'Elite' | 'Contender' | 'Prospect' | 'Veteran' | 'Gatekeeper';
}

// ─── Venue ────────────────────────────────────────────────────────────────────
export interface Venue {
  name: string;
  city: string;
  state?: string;
  country: string;
  altitudeFt: number;
  octagonSize: 'Standard (30ft)' | 'UFC Apex (25ft)';
  indoor: boolean;
}

// ─── Event / Fight ────────────────────────────────────────────────────────────
export type FightStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';
export type FightMethod = 'KO' | 'TKO' | 'Submission' | 'Decision' | 'Draw' | 'NC' | 'DQ';

export interface FightResult {
  winnerId: string;
  winnerName: string;
  method: FightMethod;
  round: number;
  time: string;
}

export interface Fight {
  id: string;
  eventId: string;
  order: number;
  isMainEvent: boolean;
  isTitleFight: boolean;
  isCoMainEvent?: boolean;
  isPrelim?: boolean;
  weightClass: string;
  scheduledRounds: number;
  fighter1: Fighter;
  fighter2: Fighter;
  status: FightStatus;
  result?: FightResult;
  espnEventId?: string;
  espnCompetitionId?: string;
}

export interface UFCEvent {
  id: string;
  name: string;
  shortName?: string;
  date: string;
  venue: Venue;
  fights: Fight[];
  status: 'upcoming' | 'live' | 'completed';
  espnEventId?: string;
}

// ─── Analysis ─────────────────────────────────────────────────────────────────
export interface MethodProbability {
  ko: number;
  submission: number;
  decision: number;
}

export interface FightAnalysis {
  fighter1WinProb: number;
  fighter2WinProb: number;
  fighter1Methods: MethodProbability;
  fighter2Methods: MethodProbability;
  predictedWinner: string;
  predictedWinnerId: string;
  predictedMethod: string;
  predictedRounds: number;
  confidence: number;
  keyFactors: string[];
  predictionReasons: string[];    // 5 sentences why predicted winner wins
  altitudeNote?: string;
  octagonNote?: string;
  cardioAdvantage?: string;
  styleMatchupNote?: string;
}

// ─── Round Stats ──────────────────────────────────────────────────────────────
export interface RoundCompetitorStats {
  sigStrikes: number;
  sigStrikesAttempted: number;
  totalStrikes: number;
  takedowns: number;
  takedownsAttempted: number;
  controlTimeSec: number;
  knockdowns: number;
  reversals: number;
}

export interface RoundData {
  round: number;
  fighter1: RoundCompetitorStats;
  fighter2: RoundCompetitorStats;
  roundWinner?: string;
  roundScore?: string;
  source: 'manual' | 'espn';
}

// ─── Prediction Tracking ──────────────────────────────────────────────────────
export interface Prediction {
  id: string;
  fightId: string;
  eventName: string;
  fighter1Name: string;
  fighter2Name: string;
  predictedWinnerId: string;
  predictedWinnerName: string;
  predictedMethod: string;
  confidence: number;
  fighter1WinProb: number;
  fighter2WinProb: number;
  createdAt: string;
  result?: {
    actualWinnerId: string;
    actualWinnerName: string;
    actualMethod: string;
    correct: boolean;
    resolvedAt: string;
  };
}

export interface PredictionRecord {
  predictions: Prediction[];
  total: number;
  correct: number;
  accuracy: number;
}

// ─── DraftKings Odds ──────────────────────────────────────────────────────────
export interface FightOdds {
  eventId: string;
  eventName: string;
  fighter1Name: string;
  fighter2Name: string;
  fighter1Moneyline: number;
  fighter2Moneyline: number;
  fighter1Implied: number;
  fighter2Implied: number;
  updatedAt: string;
}

// ─── Notable Wins ─────────────────────────────────────────────────────────────
export interface NotableWin {
  opponent: string;
  method: string;
  event?: string;
  year?: string;
}

// ─── Sentiment ────────────────────────────────────────────────────────────────
export interface SentimentTweet {
  id: string;
  text: string;
  authorName: string;
  authorHandle: string;
  createdAt: string;
  likeCount: number;
  sentiment: 'fighter1' | 'fighter2' | 'neutral';
}

export interface SentimentSummary {
  fighter1Pct: number;
  fighter2Pct: number;
  neutralPct: number;
  totalTweets: number;
  tweets: SentimentTweet[];
  updatedAt: string;
  isLive: boolean;   // true = real Twitter data, false = mock
}
