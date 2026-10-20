export interface TimerState {
  timeLimitSec: number | null;
  durationSec: number;
  activeSince: Date | null;
}

/** Sisa waktu dihitung dari timestamp server, bukan dari hitungan browser. null = tanpa batas. */
export function remainingSeconds(state: TimerState, now: Date): number | null {
  if (state.timeLimitSec === null) return null;
  const live = state.activeSince
    ? Math.max(0, Math.floor((now.getTime() - state.activeSince.getTime()) / 1000))
    : 0;
  return Math.max(0, state.timeLimitSec - state.durationSec - live);
}
