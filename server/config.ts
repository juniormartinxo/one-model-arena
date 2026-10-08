import 'dotenv/config';
import { resolve } from 'node:path';
import { z } from 'zod';
const positive = (fallback: number) => z.coerce.number().positive().default(fallback);
const env = z
  .object({
    PORT: positive(4318),
    DATA_DIR: z.string().default('./data'),
    CLAUDE_BIN: z.string().default('claude'),
    CLAUDE_ARGS: z
      .string()
      .default('[]')
      .transform((value, ctx) => {
        try {
          return JSON.parse(value);
        } catch {
          ctx.addIssue({
            code: 'custom',
            message: 'CLAUDE_ARGS deve ser uma lista JSON de argumentos.',
          });
          return z.NEVER;
        }
      })
      .pipe(z.array(z.string())),
    CLAUDE_MODEL: z.string().default('claude-opus-5-5'),
    CLAUDE_TIMEOUT_MS: positive(180000),
    CLAUDE_MAX_BUDGET_USD: positive(0.5),
    PROVIDER_TIMEOUT_MS: positive(30000),
    OPENAI_MODEL: z.string().default('gpt-6-luna'),
    JEV_MODEL: z.string().default('jev-1.13.0'),
    OPENAI_API_KEY: z.string().default(''),
    TYPESAFE_API_KEY: z.string().default(''),
    CLOUDFLARE_ACCOUNT_ID: z.string().default(''),
    CLOUDFLARE_API_TOKEN: z.string().default(''),
    CLEF_MODEL: z.enum(['clef', 'clef-flash']).default('clef'),
  })
  .parse(process.env);
export const config = { ...env, DATA_DIR: resolve(env.DATA_DIR) };
export const tariff = {
  date: '2026-10-08',
  jev: 0.042,
  decisions: 0.1,
  clef: config.CLEF_MODEL === 'clef-flash' ? 0.09 : 0.24,
};
