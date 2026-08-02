// Ack-status-polling helpers for the live-edit watch loop. Extracted from
// commandLive so the deadline / exit / resilience logic is unit-testable
// without a server (the /status fetcher is injected).
//
// The watch loop waits for each generate event's `done` reply to clear it from
// the DO's pending queue before polling the next event. waitForEventAck polls
// /status until the event is cleared, an `exit` event appears (the user closed
// the session - stop waiting), a NEWER generate appears (the user submitted
// again - stop waiting and deliver it immediately), or the deadline passes.
// Transient fetch errors are swallowed so a single blip can't kill the watcher
// or the standalone --wait-ack. Returns "cleared" | "exit" | "new" | "timeout".

export const isEventPending = (status, eid) =>
  (status?.pendingEvents || []).some((e) => e.id === eid);

export const hasExit = (status) =>
  (status?.pendingEvents || []).some((e) => e.type === "exit");

// A newer event is any pending generate or comment whose id the watcher has
// not already delivered this session (knownIds is the watcher's grow-only
// delivered set, so in-flight events waiting on their own `done` are not
// mistaken for new submissions). Comments stream in as they are posted, so
// they must not wait out an ack-wait either.
export const hasNewEvent = (status, knownIds) => {
  if (!knownIds || knownIds.size === 0) return false;
  return (status?.pendingEvents || []).some(
    (e) =>
      (e.type === "generate" || e.type === "comment") && !knownIds.has(e.id),
  );
};

export const waitForEventAck = async (
  fetchStatus,
  eid,
  { pollIntervalMs = 1000, maxWaitMs = 600_000, knownIds = null } = {},
) => {
  const deadline = Date.now() + Math.max(maxWaitMs, 0);
  for (;;) {
    let status;
    try {
      status = await fetchStatus();
    } catch (e) {
      // Transient /status failure - keep polling until the deadline.
      process.stderr.write(`[live] status poll failed: ${e.message}\n`);
      if (Date.now() >= deadline) return "timeout";
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      continue;
    }
    if (!isEventPending(status, eid)) return "cleared";
    if (hasExit(status)) return "exit";
    if (hasNewEvent(status, knownIds)) return "new";
    if (Date.now() >= deadline) return "timeout";
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
};
