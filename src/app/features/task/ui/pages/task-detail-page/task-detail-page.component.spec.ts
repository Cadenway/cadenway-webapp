import { signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { TaskDetailStore } from '../../../state/task-detail/task-detail.store';
import { TaskDetailPage } from './task-detail-page.component';

describe('TaskDetailPage', () => {
  it('shows the deleted task and lets the user retry a pending restoration', async () => {
    const pending: WritableSignal<boolean> = signal(false);
    const succeeded: WritableSignal<boolean> = signal(false);
    const failure: WritableSignal<'pending' | null> = signal(null);
    const restore: ReturnType<typeof vi.fn> = vi.fn();
    const store: Record<string, unknown> = {
      followTask: vi.fn(),
      loading: signal(false),
      loadFailure: signal('trashed'),
      trashedTask: signal({
        key: 'CAD-482',
        name: 'Refondre l’écran de connexion SSO',
        entryId: '018f1122-3344-7788-99aa-bbccddeeff00',
        trashedAt: '2026-11-06T12:00:00Z',
        purgeAt: '2026-12-06T12:00:00Z',
      }),
      restorePending: pending,
      restoreSucceeded: succeeded,
      restoreError: failure,
      restore,
      detail: signal(undefined),
    };
    TestBed.configureTestingModule({ imports: [TaskDetailPage], providers: [provideRouter([])] });
    TestBed.overrideComponent(TaskDetailPage, {
      set: { providers: [{ provide: TaskDetailStore, useValue: store }] },
    });
    const fixture: ComponentFixture<TaskDetailPage> = TestBed.createComponent(TaskDetailPage);
    fixture.componentRef.setInput('taskKey', 'CAD-482');
    fixture.componentRef.setInput('organizationId', 'org-a');
    await fixture.whenStable();

    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    const status: HTMLElement | null = host.querySelector('[role="status"]');
    expect(status?.textContent.trim()).toBe('');
    expect(host.textContent).toContain('CAD-482 « Refondre l’écran de connexion SSO »');
    const button: HTMLButtonElement | null = host.querySelector('button');
    expect(button?.textContent).toContain('Restaurer la tâche');
    button?.click();
    expect(restore).toHaveBeenCalledOnce();

    pending.set(true);
    await fixture.whenStable();
    expect(button?.disabled).toBe(true);
    expect(status?.textContent.trim()).toBe('Restauration en cours');

    pending.set(false);
    failure.set('pending');
    await fixture.whenStable();
    expect(host.textContent).toContain(
      'La mise en corbeille est en cours. Réessayez dans un instant.',
    );
    expect(button?.disabled).toBe(false);

    failure.set(null);
    succeeded.set(true);
    await fixture.whenStable();
    expect(host.querySelector('[role="status"]')).toBe(status);
    expect(status?.textContent.trim()).toBe('Tâche restaurée');
  });
});
