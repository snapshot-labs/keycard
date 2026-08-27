import { createHash } from 'crypto';

export function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}

// First second of the next month, UTC. Must stay UTC-based: the counters it
// describes are keyed by the UTC-pinned month in schema.ts, so local-time
// getters would disagree with them across the month boundary.
export function nextMonthStart(now = new Date()) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1e3;
}
