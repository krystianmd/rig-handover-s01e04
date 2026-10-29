import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, NightDigest } from './types.js';

type RunLogEntry = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEntry(line: string): RunLogEntry | null {
  let value: unknown;

  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }

  if (
    !isRecord(value)
    || typeof value.at !== 'string'
    || Number.isNaN(Date.parse(value.at))
    || typeof value.job !== 'string'
    || !['ok', 'retry', 'fail'].includes(String(value.status))
    || (typeof value.owner !== 'string' && value.owner !== null)
    || (value.error !== undefined && typeof value.error !== 'string')
  ) {
    return null;
  }

  return {
    at: value.at,
    job: value.job,
    status: value.status as DigestStatus,
    owner: value.owner,
    error: value.error ?? null,
  };
}

export function readNight(runsDir: string, night: string): NightDigest {
  const contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const lines = contents === '' ? [] : contents.split(/\r?\n/);

  if (lines.at(-1) === '') {
    lines.pop();
  }

  const rows = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of lines) {
    const entry = parseEntry(line);

    if (entry === null) {
      badLines += 1;
      continue;
    }

    const row = rows.get(entry.job);
    if (row === undefined) {
      rows.set(entry.job, {
        job: entry.job,
        owner: entry.owner,
        runs: 1,
        retries: entry.status === 'retry' ? 1 : 0,
        lastStatus: entry.status,
        lastError: entry.error,
        firstAt: entry.at,
        lastAt: entry.at,
      });
      continue;
    }

    row.runs += 1;
    row.retries += entry.status === 'retry' ? 1 : 0;

    if (Date.parse(entry.at) < Date.parse(row.firstAt)) {
      row.firstAt = entry.at;
    }

    if (Date.parse(entry.at) >= Date.parse(row.lastAt)) {
      row.owner = entry.owner;
      row.lastStatus = entry.status;
      row.lastAt = entry.at;
    }

    if (entry.error !== null) {
      row.lastError = entry.error;
    }
  }

  return { rows: [...rows.values()], badLines };
}
