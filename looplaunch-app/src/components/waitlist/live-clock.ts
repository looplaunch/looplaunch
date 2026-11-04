/**
 * The running time of a snake run, shared by the board that plays it and the leaderboard that ranks
 * it, updated every frame without re-rendering React.
 */
export interface LiveClock {
  ms: number;
  running: boolean;
  set(ms: number, running: boolean): void;
  subscribe(listener: () => void): () => void;
}

export function createLiveClock(): LiveClock {
  const listeners = new Set<() => void>();
  const clock: LiveClock = {
    ms: 0,
    running: false,
    set(ms, running) {
      clock.ms = ms;
      clock.running = running;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return clock;
}
