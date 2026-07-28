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

export declare const waitForEventAck: (
  fetchStatus: () => Promise<LiveStatus>,
  eid: string,
  opts?: { pollIntervalMs?: number; maxWaitMs?: number },
) => Promise<"cleared" | "exit" | "timeout">;
