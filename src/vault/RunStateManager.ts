import type { App } from 'obsidian';
import { stringifyYaml, parseYaml } from '../utils/yaml';
import { turnPath } from './VaultManager';
import { RUN_STATE_FILE } from '../constants';

export type RunStatus = 'idle' | 'running' | 'failed' | 'completed';

export interface RunState {
  run_id: string;
  started_at: string;
  updated_at: string;
  current_step: string;
  status: RunStatus;
  completed_steps: string[];
  last_error?: string;
  last_written_files: string[];
}

function runStatePath(slug: string, turno: number): string {
  return `${turnPath(slug, turno)}/${RUN_STATE_FILE}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeRunId(): string {
  return new Date().toISOString().replace(/[^0-9T]/g, '').slice(0, 15);
}

async function saveRunState(app: App, slug: string, turno: number, state: RunState): Promise<void> {
  const path = runStatePath(slug, turno);
  const { last_error, ...rest } = state;
  const toWrite = last_error !== undefined ? { ...rest, last_error } : rest;
  await app.vault.adapter.write(path, stringifyYaml(toWrite));
}

export async function loadRunState(app: App, slug: string, turno: number): Promise<RunState | null> {
  const path = runStatePath(slug, turno);
  const exists = await app.vault.adapter.exists(path);
  if (!exists) return null;
  try {
    const content = await app.vault.adapter.read(path);
    return parseYaml<RunState>(content);
  } catch {
    return null;
  }
}

export async function initRunState(app: App, slug: string, turno: number): Promise<void> {
  const ts = nowIso();
  await saveRunState(app, slug, turno, {
    run_id: makeRunId(),
    started_at: ts,
    updated_at: ts,
    current_step: '',
    status: 'idle',
    completed_steps: [],
    last_written_files: [],
  });
}

export async function markStepStarted(
  app: App, slug: string, turno: number, stepName: string,
): Promise<void> {
  const ts = nowIso();
  const existing = await loadRunState(app, slug, turno);
  const base: RunState = existing ?? {
    run_id: makeRunId(),
    started_at: ts,
    updated_at: ts,
    current_step: stepName,
    status: 'running',
    completed_steps: [],
    last_written_files: [],
  };
  await saveRunState(app, slug, turno, {
    ...base,
    updated_at: ts,
    current_step: stepName,
    status: 'running',
  });
}

export async function markStepCompleted(
  app: App,
  slug: string,
  turno: number,
  stepName: string,
  writtenFiles: string[],
): Promise<void> {
  const existing = await loadRunState(app, slug, turno);
  if (!existing) return;
  const { last_error: _removed, ...rest } = existing;
  await saveRunState(app, slug, turno, {
    ...rest,
    updated_at: nowIso(),
    status: 'idle',
    completed_steps: [...new Set([...existing.completed_steps, stepName])],
    last_written_files: writtenFiles,
  });
}

export async function markRunFailed(
  app: App,
  slug: string,
  turno: number,
  stepName: string,
  error: string,
): Promise<void> {
  const existing = await loadRunState(app, slug, turno);
  if (!existing) return;
  await saveRunState(app, slug, turno, {
    ...existing,
    updated_at: nowIso(),
    current_step: stepName,
    status: 'failed',
    last_error: error,
  });
}

export async function markRunCompleted(app: App, slug: string, turno: number): Promise<void> {
  const existing = await loadRunState(app, slug, turno);
  if (!existing) return;
  await saveRunState(app, slug, turno, {
    ...existing,
    updated_at: nowIso(),
    status: 'completed',
  });
}
