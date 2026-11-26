import { signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type {
  AutomationRule,
  AutomationRun,
} from '../../../models/automation-rule/automation-rule.interface';
import type { ListMember } from '../../../models/list-member/list-member.interface';
import { AutomationsStore } from '../../../state/automations/automations.store';
import { AutomationsDialog } from './automations-dialog.component';
import { runMoment } from './automation-text.util';

/**
 * Interface FakeResource
 *
 * @description
 * The part of a `ResourceRef` the dialog reads.
 */
interface FakeResource<T> {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The read value, or undefined while loading or failed.
   *
   * @type {WritableSignal<T | undefined>}
   * @readonly
   */
  readonly value: WritableSignal<T | undefined>;

  /**
   * Property error
   *
   * @description
   * The failure, or undefined.
   *
   * @type {WritableSignal<unknown>}
   * @readonly
   */
  readonly error: WritableSignal<unknown>;

  /**
   * Property hasValue
   *
   * @description
   * Whether a value is read.
   *
   * @type {() => boolean}
   * @readonly
   */
  readonly hasValue: () => boolean;

  /**
   * Property reload
   *
   * @description
   * Retry.
   *
   * @type {Mock}
   * @readonly
   */
  readonly reload: Mock;
  // #endregion
}

/**
 * Function fakeResource
 *
 * @description
 * A resource holding a value.
 *
 * @param {T | undefined} initial - Its value.
 * @returns {FakeResource<T>} The fake.
 */
function fakeResource<T>(initial: T | undefined): FakeResource<T> {
  const value: WritableSignal<T | undefined> = signal(initial);
  return {
    value,
    error: signal<unknown>(undefined),
    hasValue: (): boolean => value() !== undefined,
    reload: vi.fn(),
  };
}

/**
 * Constant MEMBERS
 *
 * @description
 * Two Atelier Nord members.
 *
 * @type {readonly ListMember[]}
 */
const MEMBERS: readonly ListMember[] = [
  { userId: 'u-camille', name: 'Camille Martin' },
  { userId: 'u-hugo', name: 'Hugo Dubois' },
];

/**
 * Constant RULES
 *
 * @description
 * `AUTOS_INIT` of the mockup: two enabled rules and a disabled one.
 *
 * @type {readonly AutomationRule[]}
 */
const RULES: readonly AutomationRule[] = [
  {
    id: 'a1',
    trigger: { type: 'status', status: 'done' },
    action: { type: 'notify', userId: 'u-hugo' },
    enabled: true,
    version: 1,
  },
  {
    id: 'a2',
    trigger: { type: 'status', status: 'blocked' },
    action: { type: 'priority', priority: 'urgente' },
    enabled: true,
    version: 1,
  },
  {
    id: 'a3',
    trigger: { type: 'created' },
    action: { type: 'assign', userId: 'u-camille' },
    enabled: false,
    version: 1,
  },
];

/**
 * Constant RUNS
 *
 * @description
 * One run of `a1`.
 *
 * @type {readonly AutomationRun[]}
 */
const RUNS: readonly AutomationRun[] = [
  {
    id: 'x1',
    ruleId: 'a1',
    taskKey: 'CAD-482',
    action: { type: 'notify', userId: 'u-hugo' },
    executedAt: new Date().toISOString(),
  },
];

/**
 * Function text
 *
 * @description
 * The text of the page, the overlays included.
 *
 * @returns {string} The text.
 */
function text(): string {
  return document.body.textContent;
}

/**
 * Function buttonNamed
 *
 * @description
 * A button by its text or accessible name.
 *
 * @param {string} name - The name.
 * @returns {HTMLButtonElement | undefined} The button.
 */
function buttonNamed(name: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (button: HTMLButtonElement): boolean =>
      button.textContent.trim() === name || button.getAttribute('aria-label') === name,
  );
}

/**
 * Function byTestId
 *
 * @description
 * An element by its `data-testid`.
 *
 * @param {string} id - The test id.
 * @returns {HTMLElement | null} The element.
 */
function byTestId(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

describe('AutomationsDialog', () => {
  let fixture: ComponentFixture<AutomationsDialog>;
  let rules: FakeResource<readonly AutomationRule[]>;
  let runs: FakeResource<readonly AutomationRun[]>;
  let members: FakeResource<readonly ListMember[]>;
  let shownRules: WritableSignal<readonly AutomationRule[]>;
  let store: Record<string, unknown> &
    Record<'load' | 'toggle' | 'remove' | 'create' | 'discardDraft', Mock>;
  let toasts: Record<'show' | 'error' | 'warning', Mock>;

  beforeEach(async () => {
    rules = fakeResource(RULES);
    runs = fakeResource(RUNS);
    members = fakeResource(MEMBERS);
    shownRules = signal(RULES);
    store = {
      rules,
      runs,
      members,
      confirmedRules: rules.value,
      shownRules,
      activeCount: signal(2),
      creating: signal(false),
      load: vi.fn(),
      toggle: vi.fn(() => Promise.resolve('applied')),
      remove: vi.fn(() => Promise.resolve('applied')),
      create: vi.fn(),
      discardDraft: vi.fn(),
    };
    toasts = { show: vi.fn(), error: vi.fn(), warning: vi.fn() };
    TestBed.configureTestingModule({
      providers: [provideCadenwayIcons(), { provide: CwToastService, useValue: toasts }],
    });
    TestBed.overrideComponent(AutomationsDialog, {
      set: { providers: [{ provide: AutomationsStore, useValue: store }] },
    });
    fixture = TestBed.createComponent(AutomationsDialog);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('reads on opening and shows the rules, the active count and the last runs', () => {
    expect(store.load).toHaveBeenCalledTimes(1);
    expect(text()).toContain(
      '“When… then…” rules applied to every task of the workspace · 2 active.',
    );
    expect(text()).toContain('When the status becomes “Done”');
    expect(text()).toContain('then notify Hugo Dubois');
    expect(text()).toContain('then set the priority to urgent');
    expect(text()).toContain('When a task is created');
    expect(text()).toContain('then assign to Camille Martin');
    expect(text()).toContain('Last runs');
    expect(text()).toContain('Hugo Dubois notified about CAD-482');
    expect(text()).toContain('just now');
    expect(text()).not.toContain('Git');
  });

  it('tells a failed read from an empty one, and retries', async () => {
    rules.value.set(undefined);
    rules.error.set(new Error('503'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(text()).toContain('The automations could not be loaded.');
    expect(text()).not.toContain('No automation yet.');
    buttonNamed('Retry')?.click();
    expect(rules.reload).toHaveBeenCalled();

    rules.error.set(undefined);
    rules.value.set([]);
    shownRules.set([]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(text()).toContain('No automation yet.');
    expect(text()).not.toContain('The automations could not be loaded.');
  });

  it('switches a rule and shows a toast when the gateway refuses', async () => {
    store.toggle.mockResolvedValueOnce('refused');

    buttonNamed('Disable: When the status becomes “Done”, notify Hugo Dubois')?.click();
    await fixture.whenStable();

    expect(store.toggle).toHaveBeenCalledWith(RULES[0]);
    expect(toasts.error).toHaveBeenCalledWith('The automation could not be changed');
    expect(buttonNamed('Enable: When a task is created, assign to Camille Martin')).toBeDefined();
  });

  it('warns when a switch or a deletion with a lost answer did not apply', async () => {
    store.toggle.mockResolvedValueOnce('not-applied').mockResolvedValueOnce('unknown');
    store.remove.mockResolvedValueOnce('not-applied');

    buttonNamed('Disable: When the status becomes “Done”, notify Hugo Dubois')?.click();
    await fixture.whenStable();
    expect(toasts.warning).toHaveBeenLastCalledWith('The automation was not changed');

    buttonNamed('Disable: When the status becomes “Done”, notify Hugo Dubois')?.click();
    await fixture.whenStable();
    expect(toasts.warning).toHaveBeenLastCalledWith(
      'The change to the automation could not be confirmed',
    );

    buttonNamed('Delete: When the status becomes “Blocked”, set the priority to urgent')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    byTestId('automation-delete-confirm')?.click();
    await fixture.whenStable();
    expect(toasts.warning).toHaveBeenLastCalledWith('The automation was not deleted');
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('confirms a deletion before deleting the rule', async () => {
    buttonNamed('Delete: When the status becomes “Blocked”, set the priority to urgent')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(text()).toContain('Delete this automation?');
    expect(text()).toContain(
      'When the status becomes “Blocked”, set the priority to urgent. It will no longer run.',
    );
    expect(store.remove).not.toHaveBeenCalled();

    byTestId('automation-delete-confirm')?.click();
    await fixture.whenStable();
    expect(store.remove).toHaveBeenCalledWith(RULES[1]);
  });

  it('builds a comment rule, created only once its text is typed', async () => {
    byTestId('automation-new')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(byTestId('automation-preview')?.textContent).toContain(
      'When the status becomes “In review”, then notify Camille Martin.',
    );
    buttonNamed('Task created')?.click();
    buttonNamed('Add a comment')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const create: HTMLButtonElement | null = byTestId(
      'automation-create',
    ) as HTMLButtonElement | null;
    expect(create?.disabled).toBe(true);

    const comment: HTMLInputElement | null = byTestId(
      'automation-comment',
    ) as HTMLInputElement | null;
    if (comment) {
      comment.value = 'Welcome aboard';
      comment.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    expect(create?.disabled).toBe(false);
    expect(byTestId('automation-preview')?.textContent).toContain(
      'When a task is created, then comment “Welcome aboard”.',
    );

    store.create.mockResolvedValueOnce({
      id: 'a4',
      trigger: { type: 'created' },
      action: { type: 'comment', body: 'Welcome aboard' },
      enabled: true,
      version: 1,
    });
    create?.click();
    await fixture.whenStable();

    expect(store.create).toHaveBeenCalledWith({
      trigger: { type: 'created' },
      action: { type: 'comment', body: 'Welcome aboard' },
    });
    expect(toasts.show).toHaveBeenCalledWith('Automation created', {
      description: 'When a task is created, then comment “Welcome aboard”.',
    });
    fixture.detectChanges();
    expect(byTestId('automation-builder')).toBeNull();
  });

  it('blocks a comment over 5,000 characters with its message', async () => {
    byTestId('automation-new')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    buttonNamed('Add a comment')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const comment: HTMLInputElement | null = byTestId(
      'automation-comment',
    ) as HTMLInputElement | null;
    const create: HTMLButtonElement | null = byTestId(
      'automation-create',
    ) as HTMLButtonElement | null;
    expect(comment?.getAttribute('maxlength')).toBe('5000');

    if (comment) {
      comment.value = 'x'.repeat(5001);
      comment.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    expect(create?.disabled).toBe(true);
    expect(byTestId('automation-comment-error')?.textContent).toContain(
      'Keep the comment to 5,000 characters or fewer.',
    );
    expect(comment?.getAttribute('aria-describedby')).toBe('automation-comment-error');
    create?.click();
    await fixture.whenStable();
    expect(store.create).not.toHaveBeenCalled();

    if (comment) {
      comment.value = 'x'.repeat(5000);
      comment.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    expect(create?.disabled).toBe(false);
    expect(byTestId('automation-comment-error')).toBeNull();
  });

  it('keeps the builder open with its values when the creation is refused', async () => {
    store.create.mockResolvedValueOnce(null);
    byTestId('automation-new')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    buttonNamed('Hugo Dubois')?.click();
    fixture.detectChanges();

    (byTestId('automation-create') as HTMLButtonElement | null)?.click();
    await fixture.whenStable();

    expect(store.create).toHaveBeenCalledWith({
      trigger: { type: 'status', status: 'review' },
      action: { type: 'notify', userId: 'u-hugo' },
    });
    expect(toasts.error).toHaveBeenCalledWith('The automation could not be created');
    fixture.detectChanges();
    expect(byTestId('automation-builder')).not.toBeNull();

    buttonNamed('Cancel')?.click();
    fixture.detectChanges();
    expect(store.discardDraft).toHaveBeenCalled();
    byTestId('automation-new')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(byTestId('automation-preview')?.textContent).toContain(
      'When the status becomes “In review”, then notify Hugo Dubois.',
    );
    expect(buttonNamed('Hugo Dubois')?.getAttribute('aria-checked')).toBe('true');
  });

  it('says when a run happened', () => {
    const now: Date = new Date('2026-11-26T15:00:00Z');
    expect(runMoment('2026-11-26T14:59:30Z', now, 'en-US')).toBe('just now');
    expect(runMoment('2026-11-26T14:48:00Z', now, 'en-US')).toBe('12 min ago');
    expect(runMoment('2026-11-20T08:05:00Z', now, 'en-US')).toBe('20 Nov');
  });
});
