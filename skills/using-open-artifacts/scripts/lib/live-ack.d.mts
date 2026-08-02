export interface LivePendingEvent {
  id: string;
  type: string;
  leased_until: number;
  created_at: number;
}

export interface LiveStatus {
  pendingEvents?: LivePendingEvent[];
}

export declare const isEventPending: (
  status: LiveStatus | undefined | null,
  eid: string,
) => boolean;

export declare const hasExit: (
  status: LiveStatus | undefined | null,
) => boolean;

// A newer generate is any pending generate whose id is not in the watcher's
// grow-only delivered set (knownIds). Off (returns false) when knownIds is
// null — the standalone --wait-ack contract.
export declare const hasNewEvent: (
  status: LiveStatus | undefined | null,
  knownIds: Set<string> | null,
) => boolean;

// Returns "new" when a newer generate appears while the target event is still
// pending, so the watch loop can deliver new submissions immediately instead
// of blocking for the ack timeout.
export declare const waitForEventAck: (
  fetchStatus: () => Promise<LiveStatus>,
  eid: string,
  opts?: {
    pollIntervalMs?: number;
    maxWaitMs?: number;
    knownIds?: Set<string> | null;
  },
) => Promise<"cleared" | "exit" | "new" | "timeout">;
