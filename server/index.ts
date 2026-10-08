import { join } from 'node:path';
import { config } from './config';
import { Store } from './store';
import { Engine } from './engine';
import { buildApp } from './app';
const store = new Store(join(config.DATA_DIR, 'meetings.sqlite'));
store.recover();
const engine = new Engine(store);
const app = await buildApp(engine);
await app.listen({ host: '127.0.0.1', port: config.PORT });
console.log(`Mesa de decisão: backend em http://127.0.0.1:${config.PORT}`);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  engine.close();
  app.server.closeAllConnections();
  await app.close();
  store.close();
  process.exit(0);
}
process.on('SIGTERM', () => void close());
process.on('SIGINT', () => void close());
