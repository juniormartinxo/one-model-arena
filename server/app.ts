import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { scenarios } from './scenarios';
import type { Engine } from './engine';
export async function buildApp(engine: Engine) {
  const app = Fastify({ logger: false, bodyLimit: 16384 });
  app.addHook('onRequest', async (req, reply) => {
    const hostname = req.headers.host?.split(':')[0];
    if (!['localhost', '127.0.0.1'].includes(hostname ?? ''))
      return reply.code(403).send({ error: 'Este servidor aceita somente acesso local.' });
    const origin = req.headers.origin;
    if (origin) {
      let host = '';
      try {
        host = new URL(origin).hostname;
      } catch {}
      if (!['localhost', '127.0.0.1'].includes(host))
        return reply.code(403).send({ error: 'Origem não permitida.' });
    }
    if (req.headers['sec-fetch-site'] === 'cross-site')
      return reply.code(403).send({ error: 'Solicitação entre sites não permitida.' });
  });
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    return payload;
  });
  app.setErrorHandler((error, _req, reply) => {
    const message =
      error instanceof z.ZodError
        ? 'Solicitação inválida.'
        : error instanceof Error
          ? error.message
          : 'Falha inesperada.';
    reply.code(400).send({ error: message });
  });
  app.get('/api/health', () => engine.health());
  app.get('/api/scenarios', () => scenarios);
  app.get('/api/runs', () => engine.store.list());
  app.delete('/api/runs', () => ({ removed: engine.store.clearHistory() }));
  app.post('/api/runs', async (req) => {
    const body = z
      .object({ scenarioId: z.string(), mode: z.enum(['demo', 'live']) })
      .strict()
      .parse(req.body);
    return engine.create(body.scenarioId, body.mode);
  });
  const idSchema = z.object({ id: z.uuid() });
  app.delete('/api/runs/:id', (req, reply) => {
    const removed = engine.store.remove(idSchema.parse(req.params).id);
    return removed ? { removed: 1 } : reply.code(404).send({ error: 'Reunião não encontrada.' });
  });
  app.get('/api/runs/:id', async (req, reply) => {
    const { id } = idSchema.parse(req.params);
    const run = engine.store.get(id);
    return run ?? reply.code(404).send({ error: 'Reunião não encontrada.' });
  });
  app.post('/api/runs/:id/advance', (req) => engine.advance(idSchema.parse(req.params).id));
  app.post('/api/runs/:id/cancel', (req) => engine.cancel(idSchema.parse(req.params).id));
  app.get('/api/runs/:id/export', async (req, reply) => {
    const { id } = idSchema.parse(req.params);
    const run = engine.store.get(id);
    if (!run) return reply.code(404).send({ error: 'Reunião não encontrada.' });
    return reply
      .header('Content-Disposition', `attachment; filename="reuniao-${id}.json"`)
      .send({ formatVersion: 1, run, events: engine.store.events(id) });
  });
  app.get('/api/runs/:id/events', async (req, reply) => {
    const { id } = idSchema.parse(req.params);
    const run = engine.store.get(id);
    if (!run) return reply.code(404).send({ error: 'Reunião não encontrada.' });
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = (value: unknown) => {
      if (!reply.raw.destroyed) reply.raw.write(`data: ${JSON.stringify(value)}\n\n`);
    };
    engine.events.on(id, send);
    send(run);
    const timer = setInterval(() => {
      if (!reply.raw.destroyed) reply.raw.write(': keepalive\n\n');
    }, 15000);
    reply.raw.on('close', () => {
      clearInterval(timer);
      engine.events.off(id, send);
    });
  });
  const dist = resolve('dist');
  if (existsSync(dist)) {
    await app.register(fastifyStatic, { root: dist });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith('/api/')
        ? reply.code(404).send({ error: 'Rota não encontrada.' })
        : reply.sendFile('index.html'),
    );
  }
  return app;
}
