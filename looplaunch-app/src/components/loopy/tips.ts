/** Loopy's one-line tips, matched to what a piece of text talks about. Shared by server and client. */

const TIPS: { match: RegExp; tips: string[] }[] = [
  {
    match: /(tiktok|reels?|shorts?|short-form|video|hook)/i,
    tips: [
      "Your first 3 seconds decide everything. Film the hook five ways and post the best one.",
      "Post the video that scares you a little. Safe content rarely gets shared.",
      "Batch-film on one day, post all week. Consistency beats perfection.",
    ],
  },
  {
    match: /(outbound|cold email|dm|linkedin|founder-led|sales)/i,
    tips: [
      "Send 10 personal messages before you automate 1,000. Learn what lands first.",
      "Lead with their problem, not your product. Nobody replies to a feature list.",
    ],
  },
  {
    match: /(position|messag|value prop|differentiat|tagline)/i,
    tips: [
      "If a stranger can't repeat your one-liner, it's not done yet. Test it on three people today.",
      "Pick one thing you're best at and say it everywhere. Being everything means being forgettable.",
    ],
  },
  {
    match: /(competitor|rival|moat|versus|vs\.)/i,
    tips: [
      "Read your competitors' 1-star reviews. That's your roadmap, written by their customers.",
      "Don't copy competitors. Find the gap they're ignoring and own it.",
    ],
  },
  {
    match: /(seo|search|google|keyword|blog)/i,
    tips: [
      "Write the answer your customer googles at 2am. That page will work for years.",
    ],
  },
  {
    match: /(ads?|paid|cpc|budget|meta|roas)/i,
    tips: [
      "Prove it organically before you pay to scale it. Ads amplify, they don't fix.",
    ],
  },
  {
    match: /(funnel|conversion|landing page|checkout|signup)/i,
    tips: [
      "Remove one field from your signup form today. Every click you cut is money back.",
    ],
  },
];

const GENERAL_TIPS = [
  "Don't do all of this at once. Pick the first step and ship it today.",
  "Done this week beats perfect next month. Start with the smallest step.",
  "Measure one number this week. If it doesn't move, change the plan, not the goal.",
  "Talk to one customer before you build anything new. They'll save you weeks.",
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickLoopyTip(content: string, seed: string): string {
  const matched = TIPS.find((t) => t.match.test(content));
  const pool = matched ? matched.tips : GENERAL_TIPS;
  return pool[hash(seed) % pool.length];
}


/** Like pickLoopyTip, but a different tip each day for the same content and seed. */
export function pickDailyTip(content: string, seed: string): string {
  return pickLoopyTip(content, `${seed}:${Math.floor(Date.now() / 86_400_000)}`);
}

/** Several different tips for a deck: the matched ones first, then general ones, starting at a daily offset. */
export function pickTips(content: string, seed: string, count = 4): string[] {
  const matched = TIPS.find((t) => t.match.test(content))?.tips ?? [];
  const pool = [...matched, ...GENERAL_TIPS.filter((tip) => !matched.includes(tip))];
  const start = hash(`${seed}:${Math.floor(Date.now() / 86_400_000)}`) % Math.max(1, matched.length || pool.length);
  const ordered = [...pool.slice(start), ...pool.slice(0, start)];
  return ordered.slice(0, Math.min(count, ordered.length));
}
