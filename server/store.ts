import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Run, RunSummary } from '../shared/types';
import { summarizeRun } from '../shared/run-summary';
export class Store {
  private db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, snapshot TEXT NOT NULL); CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, at TEXT NOT NULL, phase TEXT NOT NULL, snapshot TEXT NOT NULL);',
    );
  }
  save(run: Run) {
    run.updatedAt = new Date().toISOString();
    const json = JSON.stringify(run);
    this.db.exec('BEGIN');
    try {
      this.db
        .prepare(
          'INSERT INTO runs(id,snapshot) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET snapshot=excluded.snapshot',
        )
        .run(run.id, json);
      this.db
        .prepare('INSERT INTO events(run_id,at,phase,snapshot) VALUES(?,?,?,?)')
        .run(run.id, run.updatedAt, run.phase, json);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  get(id: string): Run | undefined {
    const row = this.db.prepare('SELECT snapshot FROM runs WHERE id=?').get(id);
    return row ? JSON.parse(String(row.snapshot)) : undefined;
  }
  list(): RunSummary[] {
    return this.db
      .prepare('SELECT snapshot FROM runs ORDER BY rowid DESC LIMIT 100')
      .all()
      .map((row) => {
        const run: Run = JSON.parse(String(row.snapshot));
        return summarizeRun(run);
      });
  }
  recover() {
    for (const row of this.db.prepare('SELECT snapshot FROM runs').all()) {
      const run: Run = JSON.parse(String(row.snapshot));
      if (!['complete', 'cancelled', 'failed'].includes(run.phase)) {
        run.phase = 'failed';
        run.error =
          'Servidor reiniciado durante a reunião. Respostas preservadas; inicie uma nova execução.';
        this.save(run);
      }
    }
  }
  events(id: string) {
    return this.db
      .prepare('SELECT seq, at, phase, snapshot FROM events WHERE run_id=? ORDER BY seq')
      .all(id)
      .map((r) => ({ ...r, snapshot: JSON.parse(String(r.snapshot)) }));
  }
  remove(id: string) {
    const run = this.get(id);
    if (!run) return false;
    if (!['complete', 'cancelled', 'failed'].includes(run.phase))
      throw new Error('Encerre a reunião em andamento antes de excluí-la.');
    this.db.exec('BEGIN');
    try {
      this.db.prepare('DELETE FROM events WHERE run_id=?').run(id);
      this.db.prepare('DELETE FROM runs WHERE id=?').run(id);
      this.db.exec('COMMIT');
      return true;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  clearHistory() {
    const finished =
      "SELECT id FROM runs WHERE json_extract(snapshot, '$.phase') IN ('complete', 'cancelled', 'failed')";
    this.db.exec('BEGIN');
    try {
      this.db.exec(`DELETE FROM events WHERE run_id IN (${finished})`);
      const result = this.db.prepare(`DELETE FROM runs WHERE id IN (${finished})`).run();
      this.db.exec('COMMIT');
      return Number(result.changes);
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  close() {
    this.db.close();
  }
}
