import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Brava, BravaSummary, Run, RunSummary, Series, SeriesSummary } from '../shared/types';
import { summarizeRun, summarizeSeries } from '../shared/run-summary';
import { withCurrentReport } from '../shared/brava-report';
const terminal = "('complete', 'cancelled', 'failed')";
export class Store {
  private db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, snapshot TEXT NOT NULL); CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, at TEXT NOT NULL, phase TEXT NOT NULL, snapshot TEXT NOT NULL); CREATE TABLE IF NOT EXISTS series(id TEXT PRIMARY KEY, snapshot TEXT NOT NULL); CREATE TABLE IF NOT EXISTS bravas(id TEXT PRIMARY KEY, snapshot TEXT NOT NULL);',
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
  // Meetings that belong to a marathon are listed through the marathon.
  list(): RunSummary[] {
    return this.db
      .prepare(
        "SELECT snapshot FROM runs WHERE json_extract(snapshot, '$.seriesId') IS NULL ORDER BY rowid DESC LIMIT 100",
      )
      .all()
      .map((row) => {
        const run: Run = JSON.parse(String(row.snapshot));
        return summarizeRun(run);
      });
  }
  hasActive() {
    return !!(
      this.db
        .prepare(`SELECT 1 FROM runs WHERE json_extract(snapshot, '$.phase') NOT IN ${terminal}`)
        .get() ||
      this.db
        .prepare(`SELECT 1 FROM series WHERE json_extract(snapshot, '$.phase') = 'running'`)
        .get() ||
      this.db
        .prepare(`SELECT 1 FROM bravas WHERE json_extract(snapshot, '$.phase') NOT IN ${terminal}`)
        .get()
    );
  }
  saveSeries(series: Series) {
    series.updatedAt = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO series(id,snapshot) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET snapshot=excluded.snapshot',
      )
      .run(series.id, JSON.stringify(series));
  }
  getSeries(id: string): Series | undefined {
    const row = this.db.prepare('SELECT snapshot FROM series WHERE id=?').get(id);
    return row ? JSON.parse(String(row.snapshot)) : undefined;
  }
  listSeries(): SeriesSummary[] {
    return this.db
      .prepare('SELECT snapshot FROM series ORDER BY rowid DESC LIMIT 100')
      .all()
      .map((row) => summarizeSeries(JSON.parse(String(row.snapshot))));
  }
  removeSeries(id: string) {
    const series = this.getSeries(id);
    if (!series) return false;
    if (series.phase === 'running')
      throw new Error('Encerre a Maratona de reuniões antes de excluí-la.');
    this.db.exec('BEGIN');
    try {
      for (const runId of series.runIds) {
        this.db.prepare('DELETE FROM events WHERE run_id=?').run(runId);
        this.db.prepare('DELETE FROM runs WHERE id=?').run(runId);
      }
      this.db.prepare('DELETE FROM series WHERE id=?').run(id);
      this.db.exec('COMMIT');
      return true;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  saveBrava(brava: Brava) {
    brava.updatedAt = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO bravas(id,snapshot) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET snapshot=excluded.snapshot',
      )
      .run(brava.id, JSON.stringify(brava));
  }
  getBrava(id: string): Brava | undefined {
    const row = this.db.prepare('SELECT snapshot FROM bravas WHERE id=?').get(id);
    return row ? withCurrentReport(JSON.parse(String(row.snapshot))) : undefined;
  }
  listBravas(): BravaSummary[] {
    return this.db
      .prepare('SELECT id FROM bravas ORDER BY rowid DESC LIMIT 100')
      .all()
      .map((row) => {
        const b = this.getBrava(String(row.id))!;
        return {
          id: b.id,
          kind: b.kind ?? 'brava',
          mode: b.mode,
          createdAt: b.createdAt,
          phase: b.phase,
          items: b.items.length,
          winner: b.report?.winner ?? null,
          cheapest: b.mode === 'live' && b.phase === 'complete' ? (b.report?.cheapest ?? []) : [],
        };
      });
  }
  latestSeries(mode: Series['mode']): Series | undefined {
    const row = this.db
      .prepare(
        "SELECT snapshot FROM series WHERE json_extract(snapshot, '$.phase') = 'complete' AND json_extract(snapshot, '$.mode') = ? ORDER BY rowid DESC LIMIT 1",
      )
      .get(mode);
    return row ? JSON.parse(String(row.snapshot)) : undefined;
  }
  removeBrava(id: string) {
    const brava = this.getBrava(id);
    if (!brava) return false;
    if (!['complete', 'cancelled', 'failed'].includes(brava.phase))
      throw new Error('Encerre a Resiliência antes de excluí-la.');
    this.db.prepare('DELETE FROM bravas WHERE id=?').run(id);
    return true;
  }
  recover() {
    for (const row of this.db.prepare('SELECT snapshot FROM bravas').all()) {
      const brava: Brava = JSON.parse(String(row.snapshot));
      if (!['complete', 'cancelled', 'failed'].includes(brava.phase)) {
        brava.phase = 'failed';
        delete brava.nextAt;
        brava.error =
          'Servidor reiniciado durante a Resiliência. Respostas recebidas foram preservadas.';
        this.saveBrava(brava);
      }
    }
    for (const row of this.db.prepare('SELECT snapshot FROM runs').all()) {
      const run: Run = JSON.parse(String(row.snapshot));
      if (!['complete', 'cancelled', 'failed'].includes(run.phase)) {
        run.phase = 'failed';
        delete run.nextAdvanceAt;
        run.error =
          'Servidor reiniciado durante a reunião. Respostas preservadas; inicie uma nova execução.';
        this.save(run);
      }
    }
    for (const row of this.db.prepare('SELECT snapshot FROM series').all()) {
      const series: Series = JSON.parse(String(row.snapshot));
      if (series.phase === 'running') {
        series.phase = 'failed';
        delete series.nextStartAt;
        series.error =
          'Servidor reiniciado durante a Maratona de reuniões. Reuniões concluídas foram preservadas.';
        this.saveSeries(series);
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
    const finished = `SELECT id FROM runs WHERE json_extract(snapshot, '$.phase') IN ${terminal}`;
    this.db.exec('BEGIN');
    try {
      // A finished meeting of a running marathon stays: the marathon still needs it.
      const running = this.db
        .prepare(`SELECT snapshot FROM series WHERE json_extract(snapshot, '$.phase') = 'running'`)
        .all()
        .flatMap((row) => (JSON.parse(String(row.snapshot)) as Series).runIds);
      const keep = running.length ? ` AND id NOT IN (${running.map(() => '?').join(',')})` : '';
      this.db.prepare(`DELETE FROM events WHERE run_id IN (${finished}${keep})`).run(...running);
      const result = this.db
        .prepare(`DELETE FROM runs WHERE id IN (${finished}${keep})`)
        .run(...running);
      const series = this.db
        .prepare(`DELETE FROM series WHERE json_extract(snapshot, '$.phase') != 'running'`)
        .run();
      const bravas = this.db
        .prepare(`DELETE FROM bravas WHERE json_extract(snapshot, '$.phase') IN ${terminal}`)
        .run();
      this.db.exec('COMMIT');
      return Number(result.changes) + Number(series.changes) + Number(bravas.changes);
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  close() {
    this.db.close();
  }
}
