import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { publicationSchema } from './shared/publication';

// The conclusion report is a self-contained HTML maintained in reports/; it is published as is.
const conclusionReport = 'reports/relatorio-conclusao.html';
// The published copy gains the author credit and a way back to the site. The avatar is embedded so
// that the report's "Baixar HTML" copy keeps working offline.
function publishedReport() {
  const html = readFileSync(conclusionReport, 'utf8');
  const avatar = readFileSync('public/autor/junior-martins-avatar.webp').toString('base64');
  const foot = '<div class="sidebar-foot">';
  if (html.split(foot).length !== 2 || !html.includes('</head>'))
    throw new Error(`${conclusionReport}: rodapé da barra lateral não encontrado`);
  return html
    .replace(
      '</head>',
      `<style>.sidebar-author{display:flex;align-items:center;gap:12px;margin-bottom:18px;color:var(--ink);text-decoration:none;font-weight:600;font-size:14px}.sidebar-author img{width:40px;height:40px;border-radius:50%;border:1px solid var(--line)}.sidebar-author:hover img{border-color:var(--accent)}.sidebar-author small{display:block;font-weight:400;font-size:11px;color:var(--muted)}.sidebar-site{display:inline-block;margin-top:14px;color:var(--muted)}.sidebar-site:hover{color:var(--accent)}</style></head>`,
    )
    .replace(
      foot,
      `${foot}<a class="sidebar-author" href="https://juniormartins.dev" target="_blank" rel="noreferrer"><img src="data:image/webp;base64,${avatar}" width="40" height="40" alt=""><span><small>Criado por</small>Junior Martins</span></a>`,
    )
    .replace(
      /(<div class="sidebar-foot">[\s\S]*?)(<\/div>\s*<\/aside>)/,
      '$1<a class="sidebar-site" href="https://arena.juniormartins.dev/">← Voltar ao site da Arena</a>$2',
    );
}

export default defineConfig({
  root: resolve('site'),
  publicDir: resolve('public'),
  envDir: resolve('site'),
  plugins: [
    react(),
    {
      name: 'public-only',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!/^\/relatorio\/?(?:index\.html)?$/.test(req.url?.split('?')[0] ?? '')) return next();
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(publishedReport());
        });
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
        publishedReport();
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
        this.emitFile({
          type: 'asset',
          fileName: 'relatorio/index.html',
          source: publishedReport(),
        });
      },
    },
  ],
  build: {
    outDir: resolve('dist-public'),
    emptyOutDir: true,
    sourcemap: false,
    // The CSP allows fonts from 'self' only, so small subsets must not be inlined as data: URLs.
    assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
  },
  server: { host: '127.0.0.1', port: 4319, strictPort: true },
  preview: { host: '127.0.0.1', port: 4321, strictPort: true },
});
