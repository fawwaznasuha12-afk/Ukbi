export type SessionStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED";

export type SessionAction = "start" | "pause" | "resume" | "submit" | "cancel";

const TRANSITIONS: Record<SessionStatus, Partial<Record<SessionAction, SessionStatus>>> = {
  NOT_STARTED: { start: "IN_PROGRESS", cancel: "CANCELLED" },
  IN_PROGRESS: { pause: "PAUSED", submit: "COMPLETED", cancel: "CANCELLED" },
  PAUSED: { resume: "IN_PROGRESS", submit: "COMPLETED", cancel: "CANCELLED" },
  COMPLETED: {},
  CANCELLED: {},
};

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: SessionStatus,
    public readonly action: SessionAction,
  ) {
    super(`Transisi tidak valid: ${from} --${action}-->`);
    this.name = "InvalidTransitionError";
  }
}

export function nextStatus(from: SessionStatus, action: SessionAction): SessionStatus {
  const to = TRANSITIONS[from][action];
  if (!to) throw new InvalidTransitionError(from, action);
  return to;
}

export function isTerminal(status: SessionStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}
