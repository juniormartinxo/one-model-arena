import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { publicationSchema } from './shared/publication';

export default defineConfig({
  root: resolve('site'),
  publicDir: resolve('public'),
  envDir: resolve('site'),
  plugins: [
    react(),
    {
      name: 'public-only',
      configureServer(server) {
        server.middlewares.use('/data/edition.json', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify(
              publicationSchema.parse(
                JSON.parse(readFileSync('site/content/edition.json', 'utf8')),
              ),
            ),
          );
        });
      },
      buildStart() {
        publicationSchema.parse(JSON.parse(readFileSync('site/content/edition.json', 'utf8')));
      },
      generateBundle() {
        for (const id of this.getModuleIds()) {
          if (
            /\/(src|server|scripts)\//.test(id.replaceAll('\\', '/')) &&
            !id.includes('/node_modules/')
          )
            this.error(`O site público não pode importar código do estúdio: ${id}`);
        }
        const publication = publicationSchema.parse(
          JSON.parse(readFileSync('site/content/edition.json', 'utf8')),
        );
        this.emitFile({
          type: 'asset',
          fileName: 'data/edition.json',
          source: JSON.stringify(publication, null, 2),
        });
      },
    },
  ],
  build: { outDir: resolve('dist-public'), emptyOutDir: true, sourcemap: false },
  server: { host: '127.0.0.1', port: 4319, strictPort: true },
  preview: { host: '127.0.0.1', port: 4321, strictPort: true },
});
