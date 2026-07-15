import { describe, expect, test, vi } from 'vitest';

import {
  createDiagnosticsController,
  createImportReviewController,
  createSerializedSettingsController,
  type WorkflowStateKind,
} from '../src/pages/dashboard-workflow-controllers';

describe('dashboard workflow controllers', () => {
  test('import review exposes loading, review, and success transitions', async () => {
    const states: WorkflowStateKind[] = [];
    const refresh = vi.fn();
    const controller = createImportReviewController({
      prepare: async (text: string) => ({ text, count: 2 }),
      isEmpty: review => !review?.count,
      confirm: async () => true,
      apply: async () => ({ imported: 2 }),
      refresh,
      describeResult: result => `${result.imported} imported`,
      render: state => states.push(state.kind),
    });

    const result = await controller.start('backup');

    expect(states).toEqual(['loading', 'review', 'loading', 'success']);
    expect(result).toMatchObject({ kind: 'success', message: '2 imported' });
    expect(refresh).toHaveBeenCalledOnce();
  });

  test('import review distinguishes empty data and retries a failed apply', async () => {
    const emptyController = createImportReviewController({
      prepare: async () => null as { text: string } | null,
      confirm: async () => true,
      apply: async () => ({ imported: 0 }),
    });
    expect(await emptyController.start('empty')).toMatchObject({ kind: 'empty', retryAvailable: false });

    let attempts = 0;
    const states: WorkflowStateKind[] = [];
    const retryController = createImportReviewController({
      prepare: async (text: string) => ({ text }),
      confirm: async () => true,
      apply: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('temporary import failure');
        return { imported: 1 };
      },
      render: state => states.push(state.kind),
    });

    expect(await retryController.start('backup')).toMatchObject({ kind: 'failure', retryAvailable: true });
    expect(await retryController.retry()).toMatchObject({ kind: 'success' });
    expect(states).toContain('recovery');
    expect(attempts).toBe(2);
  });

  test('settings saves are serialized per key', async () => {
    const values: Record<string, unknown> = { theme: 'dark' };
    const persisted: unknown[] = [];
    let releaseFirst!: () => void;
    const firstPersist = new Promise<void>(resolve => { releaseFirst = resolve; });
    const controller = createSerializedSettingsController({
      validate: (_key, value) => ({ ok: true, value }),
      read: key => values[key],
      write: (key, value) => { values[key] = value; },
      persist: async (_key, value) => {
        persisted.push(value);
        if (value === 'light') await firstPersist;
      },
    });

    const first = controller.save('theme', 'light');
    await vi.waitFor(() => expect(persisted).toEqual(['light']));
    const second = controller.save('theme', 'oled');
    await Promise.resolve();
    expect(persisted).toEqual(['light']);

    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(persisted).toEqual(['light', 'oled']);
    expect(values.theme).toBe('oled');
    expect(controller.getPendingKeys()).toEqual([]);
  });

  test('settings validation and persistence failures restore the previous value', async () => {
    const values: Record<string, unknown> = { size: 12 };
    const restoreInput = vi.fn();
    const setFieldError = vi.fn();
    const controller = createSerializedSettingsController({
      validate: (_key, value) => Number(value) > 0
        ? { ok: true, value: Number(value) }
        : { ok: false, error: 'Size must be positive.' },
      read: key => values[key],
      write: (key, value) => { values[key] = value; },
      persist: async () => { throw new Error('storage unavailable'); },
      restoreInput,
      setFieldError,
    });

    await expect(controller.save('size', 0)).resolves.toBe(false);
    expect(setFieldError).toHaveBeenCalledWith('size', 'Size must be positive.', {});
    await expect(controller.save('size', 14, { input: 'field' })).resolves.toBe(false);
    expect(values.size).toBe(12);
    expect(restoreInput).toHaveBeenCalledWith('size', 12, { input: 'field' });
    expect(controller.getState()).toMatchObject({ kind: 'error', message: 'Save failed' });
  });

  test('diagnostics distinguishes success, empty, failure, and degraded recovery', async () => {
    let mode: 'success' | 'empty' | 'failure' | 'recovery' = 'success';
    const states: WorkflowStateKind[] = [];
    const controller = createDiagnosticsController({
      loaders: {
        runtime: () => {
          if (mode === 'failure') throw new Error('runtime offline');
          if (mode === 'empty') return null;
          return { ready: true };
        },
        trust: () => {
          if (mode === 'failure' || mode === 'recovery') throw new Error('trust offline');
          if (mode === 'empty') return null;
          return { keys: 1 };
        },
      },
      render: state => states.push(state.kind),
    });

    expect(await controller.refresh()).toMatchObject({ kind: 'success', retryAvailable: false });
    mode = 'empty';
    expect(await controller.refresh()).toMatchObject({ kind: 'empty', retryAvailable: true });
    mode = 'failure';
    expect(await controller.refresh()).toMatchObject({ kind: 'failure', retryAvailable: true });
    mode = 'recovery';
    expect(await controller.retry()).toMatchObject({ kind: 'recovery', phase: 'degraded', retryAvailable: true });
    expect(states.filter(kind => kind === 'loading')).toHaveLength(4);
    expect(states).toContain('recovery');
  });
});
