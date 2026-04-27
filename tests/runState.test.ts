import { describe, it, expect } from 'vitest';
import type { App } from 'obsidian';
import {
  loadRunState,
  initRunState,
  markStepStarted,
  markStepCompleted,
  markRunFailed,
  markRunCompleted,
} from '../src/vault/RunStateManager';

// ---- In-memory vault mock ----

function createMockApp(files: Record<string, string> = {}): { app: App; files: Record<string, string> } {
  const store = { ...files };
  const app = {
    vault: {
      adapter: {
        exists: (path: string) => Promise.resolve(path in store),
        read: (path: string) => Promise.resolve(store[path] ?? ''),
        write: (path: string, content: string) => {
          store[path] = content;
          return Promise.resolve();
        },
      },
    },
  } as unknown as App;
  return { app, files: store };
}

const SLUG = 'test-campagna';
const TURNO = 3;
const STATE_PATH = `campagne/${SLUG}/turno-03/run-state.yaml`;

describe('RunStateManager', () => {
  it('returns null when run-state.yaml does not exist', async () => {
    const { app } = createMockApp();
    const state = await loadRunState(app, SLUG, TURNO);
    expect(state).toBeNull();
  });

  it('initRunState writes idle state', async () => {
    const { app, files } = createMockApp();
    await initRunState(app, SLUG, TURNO);
    expect(STATE_PATH in files).toBe(true);
    const state = await loadRunState(app, SLUG, TURNO);
    expect(state?.status).toBe('idle');
    expect(state?.completed_steps).toEqual([]);
  });

  it('markStepStarted sets status to running', async () => {
    const { app } = createMockApp();
    await markStepStarted(app, SLUG, TURNO, 'Step1Matrix');
    const state = await loadRunState(app, SLUG, TURNO);
    expect(state?.status).toBe('running');
    expect(state?.current_step).toBe('Step1Matrix');
  });

  it('markStepCompleted adds step to completed_steps and sets idle', async () => {
    const { app } = createMockApp();
    await markStepStarted(app, SLUG, TURNO, 'Step1Matrix');
    await markStepCompleted(app, SLUG, TURNO, 'Step1Matrix', ['campagne/test/turno-3/matrice.md']);
    const state = await loadRunState(app, SLUG, TURNO);
    expect(state?.status).toBe('idle');
    expect(state?.completed_steps).toContain('Step1Matrix');
    expect(state?.last_written_files).toContain('campagne/test/turno-3/matrice.md');
  });

  it('markRunFailed sets status to failed with error', async () => {
    const { app } = createMockApp();
    await markStepStarted(app, SLUG, TURNO, 'StepCounterArg');
    await markRunFailed(app, SLUG, TURNO, 'StepCounterArg', 'Gemini API error 429');
    const state = await loadRunState(app, SLUG, TURNO);
    expect(state?.status).toBe('failed');
    expect(state?.current_step).toBe('StepCounterArg');
    expect(state?.last_error).toBe('Gemini API error 429');
  });

  it('completed_steps accumulates across steps', async () => {
    const { app } = createMockApp();
    await markStepStarted(app, SLUG, TURNO, 'Step1Matrix');
    await markStepCompleted(app, SLUG, TURNO, 'Step1Matrix', []);
    await markStepStarted(app, SLUG, TURNO, 'StepCounterArg');
    await markStepCompleted(app, SLUG, TURNO, 'StepCounterArg', []);
    const state = await loadRunState(app, SLUG, TURNO);
    expect(state?.completed_steps).toContain('Step1Matrix');
    expect(state?.completed_steps).toContain('StepCounterArg');
  });

  it('markStepCompleted does not duplicate step in completed_steps', async () => {
    const { app } = createMockApp();
    await markStepStarted(app, SLUG, TURNO, 'Step1Matrix');
    await markStepCompleted(app, SLUG, TURNO, 'Step1Matrix', []);
    await markStepStarted(app, SLUG, TURNO, 'Step1Matrix');
    await markStepCompleted(app, SLUG, TURNO, 'Step1Matrix', []);
    const state = await loadRunState(app, SLUG, TURNO);
    expect(state?.completed_steps.filter(s => s === 'Step1Matrix')).toHaveLength(1);
  });

  it('simulates pipeline failure at second step', async () => {
    const { app } = createMockApp();
    // Step1 completes
    await markStepStarted(app, SLUG, TURNO, 'Step1Matrix');
    await markStepCompleted(app, SLUG, TURNO, 'Step1Matrix', ['matrice.md']);
    // Step2 fails
    await markStepStarted(app, SLUG, TURNO, 'StepCounterArg');
    await markRunFailed(app, SLUG, TURNO, 'StepCounterArg', 'timeout');

    const state = await loadRunState(app, SLUG, TURNO);
    expect(state?.status).toBe('failed');
    expect(state?.completed_steps).toEqual(['Step1Matrix']);
    expect(state?.current_step).toBe('StepCounterArg');
  });

  it('markRunCompleted sets status to completed', async () => {
    const { app } = createMockApp();
    await markStepStarted(app, SLUG, TURNO, 'Step1Matrix');
    await markStepCompleted(app, SLUG, TURNO, 'Step1Matrix', []);
    await markRunCompleted(app, SLUG, TURNO);
    const state = await loadRunState(app, SLUG, TURNO);
    expect(state?.status).toBe('completed');
  });

  it('clears last_error on successful completion', async () => {
    const { app } = createMockApp();
    await markStepStarted(app, SLUG, TURNO, 'Step1Matrix');
    await markRunFailed(app, SLUG, TURNO, 'Step1Matrix', 'errore precedente');
    await markStepStarted(app, SLUG, TURNO, 'Step1Matrix');
    await markStepCompleted(app, SLUG, TURNO, 'Step1Matrix', []);
    const state = await loadRunState(app, SLUG, TURNO);
    expect(state?.last_error).toBeUndefined();
  });
});
