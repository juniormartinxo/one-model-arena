import { it, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { config } from '../server/config';
import { callClaude, cliStatus, parseCliOutput } from '../server/claude';
it('rejects successful exit envelopes that contain a CLI error or missing schema output', () => {
  expect(() =>
    parseCliOutput('{"is_error":true,"result":"login required"}', z.object({ ok: z.boolean() })),
  ).toThrow('CLI');
  expect(() =>
    parseCliOutput('{"structured_output":{"unrelated":true}}', z.object({ ok: z.boolean() })),
  ).toThrow();
});
it('invokes an isolated CLI without a shell, tools, shared sessions or decision-provider secrets', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mesa-cli-test-'));
  const original = { ...config };
  const script = join(dir, 'fixture.mjs');
  await writeFile(
    script,
    `#!/usr/bin/env node\nlet prompt='';for await(const c of process.stdin)prompt+=c;const value={args:process.argv.slice(2),prompt,cwd:process.cwd(),hasKeys:Boolean(process.env.OPENAI_API_KEY||process.env.TYPESAFE_API_KEY)};console.log(JSON.stringify({structured_output:value,total_cost_usd:0,modelUsage:{'claude-opus-5-5':{}},usage:{input_tokens:10,output_tokens:20}}));`,
    { mode: 0o700 },
  );
  config.CLAUDE_BIN = script;
  config.CLAUDE_ARGS = ['perfil-teste'];
  config.DATA_DIR = dir;
  try {
    const schema = z.object({
      args: z.array(z.string()),
      prompt: z.string(),
      cwd: z.string(),
      hasKeys: z.boolean(),
    });
    const { value } = await callClaude(
      'commentator',
      'Texto com $(shell) e `comando` literal.',
      schema,
      new AbortController().signal,
    );
    expect(value.args).toContain('--no-session-persistence');
    expect(value.args[0]).toBe('perfil-teste');
    expect(value.args).toContain('--safe-mode');
    expect(value.args).not.toContain('--bare');
    expect(value.args).not.toContain('--continue');
    expect(value.args[value.args.indexOf('--tools') + 1]).toBe('');
    const sentSchema = JSON.parse(value.args[value.args.indexOf('--json-schema') + 1]);
    expect(sentSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(value.hasKeys).toBe(false);
    expect(value.cwd).toContain('/cli/session-');
    expect(value.prompt).toContain('$(shell)');
  } finally {
    Object.assign(config, original);
    await rm(dir, { recursive: true, force: true });
  }
});
it.each([
  {
    code: 0,
    response: { loggedIn: true, authMethod: 'claude.ai', email: 'private@example.test' },
    authenticated: true,
  },
  { code: 1, response: { loggedIn: false, authMethod: 'none' }, authenticated: false },
  { code: 0, response: { unknown: true }, authenticated: null },
])(
  'checks login in the configured profile without exposing account details: $authenticated',
  async ({ code, response, authenticated }) => {
    const dir = await mkdtemp(join(tmpdir(), 'mesa-auth-test-'));
    const original = { ...config };
    const script = join(dir, 'fixture.mjs');
    await writeFile(
      script,
      `#!/usr/bin/env node
const args=process.argv.slice(2);
if(args[0]!=='perfil-teste')process.exit(2);
if(args[1]==='--version'){console.log('fixture');process.exit(0);}
if(JSON.stringify(args.slice(1))!==JSON.stringify(['auth','status','--json']))process.exit(2);
console.log(JSON.stringify(${JSON.stringify(response)}));process.exit(${code});`,
      { mode: 0o700 },
    );
    config.CLAUDE_BIN = script;
    config.CLAUDE_ARGS = ['perfil-teste'];
    try {
      const status = await cliStatus();
      expect(status).toMatchObject({ available: true, version: 'fixture', authenticated });
      expect(JSON.stringify(status)).not.toContain('private@example.test');
    } finally {
      Object.assign(config, original);
      await rm(dir, { recursive: true, force: true });
    }
  },
);
