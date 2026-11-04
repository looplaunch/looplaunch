/** Shapes the waitlist API sends to the page. Types only, so the page can import them. */

export interface BoardEntry {
  id: string;
  name: string;
  timeMs: number;
}

export interface Board {
  /** The fastest few, fastest first; equal times in the order they were set. */
  top: BoardEntry[];
  /** How many people hold each time, fastest first: enough to rank any time, not only the top few. */
  counts: [timeMs: number, players: number][];
  /** Everyone on the board. */
  total: number;
}

export interface JoinResponse {
  ok: true;
  alreadyJoined: boolean;
  /** The name on the board: the one they first joined with, if they'd joined before. */
  firstName: string;
  entryId: string | null;
  /** This run's time, as the server replayed it. */
  timeMs: number | null;
  bestMs: number | null;
  /** Their best before this join, to tell a first time on the board from a new best. */
  previousBestMs: number | null;
  /** This run set a new best (or their first time). */
  improved: boolean;
  /** Where their best stands, 1 for the fastest. */
  rank: number | null;
  /** The board after this join; null while the leaderboard isn't set up. */
  board: Board | null;
  /** The run didn't check out, so only the waitlist entry was saved. */
  runRejected?: boolean;
}
