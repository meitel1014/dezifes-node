import fs from 'node:fs';
import path from 'node:path';
import type {
  MatchCandidates,
  Selection,
  TeamsPool,
  Visibility,
} from '../schemas';
import type { Mode } from '../nodecg/messages';
import { processScreenshot } from './ocr/processScreenshot';

type Logger = {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
};

type ReplicantOf<T> = { value: T | undefined };

export type StartScreenshotWatcherOptions = {
  screenshotDir: string;
  teamsPoolRep: ReplicantOf<TeamsPool>;
  selectionRep: ReplicantOf<Selection>;
  visibilityRep: ReplicantOf<Visibility>;
  matchCandidatesRep: ReplicantOf<MatchCandidates>;
  log: Logger;
};

const DEBOUNCE_MS = 200;

/**
 * 指定ディレクトリの PNG 追加を fs.watch で検知し、両チーム visible なモードに対して
 * OCR 判定を直列キューで実行する。既存ファイルは起動時に processed として扱う。
 */
export function startScreenshotWatcher(opts: StartScreenshotWatcherOptions): void {
  const { screenshotDir, teamsPoolRep, selectionRep, visibilityRep, matchCandidatesRep, log } = opts;
  const absDir = path.resolve(process.cwd(), screenshotDir);
  fs.mkdirSync(absDir, { recursive: true });

  const processed = new Set<string>();
  for (const f of fs.readdirSync(absDir)) {
    if (f.toLowerCase().endsWith('.png')) processed.add(f);
  }
  log.info(
    `Screenshot watcher ready at ${absDir} (${processed.size} existing PNGs ignored)`
  );

  const queue: string[] = [];
  let running = false;
  const pendingTimers = new Map<string, NodeJS.Timeout>();

  const enqueue = (filename: string) => {
    if (processed.has(filename)) return;
    processed.add(filename);
    queue.push(filename);
    void runQueue();
  };

  const runQueue = async () => {
    if (running) return;
    running = true;
    try {
      while (queue.length > 0) {
        const filename = queue.shift();
        if (!filename) break;
        try {
          await handleFile(filename);
        } catch (e) {
          log.error(`[screenshotWatcher] failed on ${filename}`, e);
          processed.delete(filename);
        }
      }
    } finally {
      running = false;
    }
  };

  const handleFile = async (filename: string) => {
    const full = path.join(absDir, filename);
    if (!fs.existsSync(full)) return;

    const visibility = visibilityRep.value;
    const selection = selectionRep.value;
    const pool = teamsPoolRep.value;
    if (!visibility || !selection || !pool) {
      log.warn(`[screenshotWatcher] ${filename}: Replicants not ready, skip`);
      return;
    }

    const targetModes: Mode[] = (['turfWar', 'splatZones'] as const).filter(
      (m) => visibility[m].alpha && visibility[m].bravo
    );
    if (targetModes.length === 0) {
      log.info(`[screenshotWatcher] ${filename}: 両チームvisible なモードが無いのでスキップ`);
      return;
    }

    for (const mode of targetModes) {
      log.info(`[screenshotWatcher] OCR start: ${filename} (mode=${mode})`);
      const cand = await processScreenshot({
        screenshotPath: full,
        sourceFile: filename,
        mode,
        selection,
        teamsPool: pool,
        log,
      });
      if (!cand) continue;

      const cur = matchCandidatesRep.value ?? { turfWar: null, splatZones: null };
      matchCandidatesRep.value = { ...cur, [mode]: cand };
      log.info(`[screenshotWatcher] OCR done: ${filename} (mode=${mode})`);
    }
  };

  fs.watch(absDir, { persistent: true }, (_eventType, filename) => {
    if (!filename) return;
    if (!filename.toLowerCase().endsWith('.png')) return;
    if (processed.has(filename)) return;

    // ファイル書き込み完了を待つためのデバウンス
    const existing = pendingTimers.get(filename);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      pendingTimers.delete(filename);
      enqueue(filename);
    }, DEBOUNCE_MS);
    pendingTimers.set(filename, timer);
  });
}
