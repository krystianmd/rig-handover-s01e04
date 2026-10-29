import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/types.js';

const runsDir = fileURLToPath(new URL('../runs', import.meta.url));

describe('readNight', () => {
  it('aggregates the run log and counts malformed lines', () => {
    const digest = readNight(runsDir, '2026-10-28');

    expect(digest.badLines).toBe(1);
    expect(digest.rows).toHaveLength(5);
    expect(digest.rows.map((row) => row.job)).toEqual([
      'rig/rotate-logs',
      'lane/sync',
      'fixtures/refresh',
      'notes/backup',
      'digest/render',
    ]);
  });

  it('tracks retries, latest state, errors, times, and null owners', () => {
    const digest = readNight(runsDir, '2026-10-28');

    expect(digest.rows.find((row) => row.job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(digest.rows.find((row) => row.job === 'digest/render')).toEqual({
      job: 'digest/render',
      owner: null,
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T05:41:09+01:00',
      lastAt: '2026-10-29T05:41:09+01:00',
    });
  });
});
