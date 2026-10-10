import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import sharp from 'sharp';
import { typeOfExtension } from './sample';

// The 413 estimates for photos #245/#314 tracked the Base64 size (~4 chars/token).
// 180 KiB becomes 240 KiB in Base64, leaving room for the question in 65,536 tokens.
// This is a conservative transport budget, not an exact image-token counter.
export const imagePolicy = {
  version: 'bounded-webp-v1',
  maxBytes: 180 * 1024,
  quality: 80,
} as const;

export async function imageDataUrl(path: string): Promise<string> {
  let bytes = await readFile(path);
  let type = typeOfExtension[extname(path).slice(1)];
  if (!type) throw new Error(`Formato de imagem não suportado: ${basename(path)}.`);
  if (bytes.length > imagePolicy.maxBytes) {
    // Keep resolution and framing; originals on disk remain untouched.
    bytes = await sharp(bytes).webp({ quality: imagePolicy.quality }).toBuffer();
    type = 'image/webp';
  }
  if (bytes.length > imagePolicy.maxBytes)
    throw new Error(`A foto ${basename(path)} excede 180 KiB mesmo após compactação para envio.`);
  return `data:${type};base64,${bytes.toString('base64')}`;
}
