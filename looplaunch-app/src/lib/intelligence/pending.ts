/**
 * Analyses whose first strategy is being written right now. The page asks for it as soon as the
 * research is ready, while a signed-out visitor is still logging in; when they come back, this
 * stops the page from asking a second time. The app runs as one server process, so memory is enough.
 */
const writing = new Set<string>();

export const isStrategyPending = (sessionId: string) => writing.has(sessionId);

/** Marks the strategy as being written (until releaseStrategy). Returns false if it already was. */
export function claimStrategy(sessionId: string): boolean {
  if (writing.has(sessionId)) return false;
  writing.add(sessionId);
  return true;
}

export const releaseStrategy = (sessionId: string) => writing.delete(sessionId);
