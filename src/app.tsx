import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/types.js';
import { lane } from './lane.js';
import { createDigestApi } from './routes/digest-api.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.route('/', createDigestApi(config.runsDir));
  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');

    try {
      const digest = readNight(config.runsDir, night);
      const rows = [...digest.rows].sort((a, b) => a.job.localeCompare(b.job));

      return c.html(
        <Layout title={`digest · ${night}`} lane={lane()}>
          <DigestPage night={night} rows={rows} badLines={digest.badLines} />
        </Layout>,
      );
    } catch (error) {
      if (isMissingFile(error)) {
        return c.notFound();
      }
      throw error;
    }
  });

  return app;
}
