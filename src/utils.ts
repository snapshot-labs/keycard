import { createHash } from 'crypto';

export function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}

export function nextMonthStart(now = new Date()) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1e3;
}
