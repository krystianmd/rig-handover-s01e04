import type { DigestRow } from './types.js';
import { readNight } from './types.js';

export function readSortedRows(runsDir: string, night: string): DigestRow[] {
  return readNight(runsDir, night).rows.toSorted((left, right) =>
    left.job.localeCompare(right.job),
  );
}
