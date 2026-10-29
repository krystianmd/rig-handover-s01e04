import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

const run = (job: string) =>
  JSON.stringify({
    at: '2026-10-29T01:00:00+01:00',
    job,
    status: 'ok',
    owner: 'rook',
  });

function htmlJobs(html: string): string[] {
  const tableBody = html.match(/<tbody>(.*?)<\/tbody>/s)?.[1] ?? '';
  return [...tableBody.matchAll(/<tr><td>(.*?)<\/td>/g)].map((match) => match[1]);
}

describe('digest routes', () => {
  let runsDir: string;

  beforeEach(() => {
    runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(
      join(runsDir, '2026-10-28.jsonl'),
      [run('zeta/job'), run('alpha/job'), run('middle/job')].join('\n'),
    );
    writeFileSync(join(runsDir, 'empty.jsonl'), '');
    writeFileSync(
      join(runsDir, 'malformed.jsonl'),
      [run('valid/job'), '{"job":', run('another/job')].join('\n'),
    );
  });

  afterEach(() => {
    rmSync(runsDir, { recursive: true, force: true });
  });

  function app() {
    return createApp({
      adapter: 'shim',
      installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60,
      runsDir,
    });
  }

  it('serves a populated night with identical sorted HTML and JSON jobs', async () => {
    const htmlResponse = await app().request('/digest/2026-10-28');
    const jsonResponse = await app().request('/api/digest/2026-10-28');
    const html = await htmlResponse.text();
    const rows = await jsonResponse.json() as DigestRow[];
    const jobs = rows.map((row) => row.job);

    expect(htmlResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(htmlJobs(html)).toEqual(['alpha/job', 'middle/job', 'zeta/job']);
    expect(htmlJobs(html)).toEqual(jobs);
  });

  it('returns 404 from both endpoints when the night file is missing', async () => {
    const htmlResponse = await app().request('/digest/missing');
    const jsonResponse = await app().request('/api/digest/missing');

    expect(htmlResponse.status).toBe(404);
    expect(jsonResponse.status).toBe(404);
  });

  it('renders nothing ran and returns no rows for an empty night', async () => {
    const htmlResponse = await app().request('/digest/empty');
    const jsonResponse = await app().request('/api/digest/empty');

    expect(htmlResponse.status).toBe(200);
    expect(await htmlResponse.text()).toContain('nothing ran');
    expect(jsonResponse.status).toBe(200);
    expect(await jsonResponse.json()).toEqual([]);
  });

  it('skips a malformed line and serves the valid rows from both endpoints', async () => {
    const htmlResponse = await app().request('/digest/malformed');
    const jsonResponse = await app().request('/api/digest/malformed');
    const html = await htmlResponse.text();
    const rows = await jsonResponse.json() as DigestRow[];

    expect(htmlResponse.status).toBe(200);
    expect(htmlJobs(html)).toEqual(['another/job', 'valid/job']);
    expect(html).toContain('1 malformed line skipped');
    expect(jsonResponse.status).toBe(200);
    expect(rows.map((row) => row.job)).toEqual(['another/job', 'valid/job']);
  });
});
