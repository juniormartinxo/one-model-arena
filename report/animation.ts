import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// Embed the same renderer used by dev:public, without a browser dependency on React.
export function arenaAnimationScript() {
  return stripTypeScriptTypes(readFileSync('shared/arena-sculpture.ts', 'utf8')).replace(
    'export function animateArenaSculpture',
    'function animateArenaSculpture',
  );
}
