import { join, resolve } from 'node:path';

// CV-Bench (Tong et al., 2024): multiple-choice questions about real photos, with red, blue and
// green boxes already drawn on the images. Its annotations are Apache-2.0, so the sampled
// questions live in the repository; the photos come from ADE20K, COCO and Omni3D under their own
// terms and are downloaded by `npm run imagens` into data/ (never committed).
export type CvTask = 'Count' | 'Relation' | 'Depth' | 'Distance';
export type CvSampleItem = {
  idx: number;
  task: CvTask;
  source: string;
  sourceDataset: string;
  question: string;
  choices: string[];
  // Letter of the right choice, as the dataset writes it: "(A)".
  answer: string;
};
export type CvSample = { seed: string; items: CvSampleItem[] };
export const samplePath = resolve(import.meta.dirname, 'cvbench-sample.json');
export const imagesDir = (dataDir: string) => join(dataDir, 'datasets', 'imagens');
export const imageExtensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
type ImageType = keyof typeof imageExtensions;
export const typeOfExtension = Object.fromEntries(
  Object.entries(imageExtensions).map(([type, ext]) => [ext, type as ImageType]),
) as Record<string, ImageType>;
// The dataset server labels every file as binary, so the format comes from the first bytes.
export function imageType(bytes: Uint8Array): ImageType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'image/png';
  if (String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}
export const cvbenchInfo = {
  name: 'CV-Bench',
  license: 'Apache-2.0 (anotações); fotos de ADE20K, COCO e Omni3D com termos próprios',
  url: 'https://huggingface.co/datasets/nyu-visionx/CV-Bench',
  citation:
    'Tong et al. (2024). Cambrian-1: A Fully Open, Vision-Centric Exploration of Multimodal LLMs. NeurIPS 2024.',
};
