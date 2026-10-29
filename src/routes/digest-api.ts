import { Hono } from 'hono';
import { readSortedRows } from '../digest/sorted.js';

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export function createDigestApi(runsDir: string) {
  const app = new Hono();

  app.get('/api/digest/:night', (c) => {
    try {
      return c.json(readSortedRows(runsDir, c.req.param('night')));
    } catch (error) {
      if (isMissingFile(error)) {
        return c.json({ error: 'night not found' }, 404);
      }

      throw error;
    }
  });

  return app;
}
