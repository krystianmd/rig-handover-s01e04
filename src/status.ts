import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { RigConfig } from './config.js';
import type { DigestStatus } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type NightStatus = {
  night: string;
  counts: Record<DigestStatus, number>;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightStatus[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

function countNight(runsDir: string, night: string): NightStatus {
  const counts: Record<DigestStatus, number> = { ok: 0, retry: 0, fail: 0 };

  try {
    const lines = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8').split(/\r?\n/);

    for (const line of lines) {
      let value: unknown;

      try {
        value = JSON.parse(line);
      } catch {
        continue;
      }

      if (typeof value !== 'object' || value === null || !('status' in value)) {
        continue;
      }

      const status = value.status;
      if (status === 'ok' || status === 'retry' || status === 'fail') {
        counts[status] += 1;
      }
    }
  } catch {
    // The directory listing is still useful if a file disappears between reads.
  }

  return { night, counts };
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => countNight(config.runsDir, night)),
  };
}
