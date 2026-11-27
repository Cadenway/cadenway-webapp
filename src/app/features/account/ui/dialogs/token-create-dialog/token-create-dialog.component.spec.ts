import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiTokenDraft } from '../../../models/api-token/api-token.interface';
import { TokenCreateDialog } from './token-create-dialog.component';

/**
 * Function dialog
 *
 * @description
 * The open create dialog.
 *
 * @returns {HTMLElement | null} The dialog, or null while closed.
 */
function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

/**
 * Function byTestId
 *
 * @description
 * An element of the dialog by its `data-testid`.
 *
 * @param {string} id - The test id.
 * @returns {HTMLElement | null} The element.
 */
function byTestId(id: string): HTMLElement | null {
  return dialog()?.querySelector<HTMLElement>(`[data-testid="${id}"]`) ?? null;
}

/**
 * Function typeName
 *
 * @description
 * Types the token name.
 *
 * @param {string} value - Typed text.
 */
function typeName(value: string): void {
  const field: HTMLInputElement | null =
    dialog()?.querySelector<HTMLInputElement>('#token-name') ?? null;
  if (field === null) throw new Error('Expected the name field.');
  field.value = value;
  field.dispatchEvent(new Event('input'));
}

/**
 * Function alerts
 *
 * @description
 * Texts of the field errors shown.
 *
 * @returns {string[]} The texts.
 */
function alerts(): string[] {
  return [...(dialog()?.querySelectorAll('[role="alert"]') ?? [])].map((alert: Element): string =>
    alert.textContent.trim(),
  );
}

describe('TokenCreateDialog', () => {
  let fixture: ComponentFixture<TokenCreateDialog>;
  let drafts: ApiTokenDraft[];
  let dismissed: number;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(TokenCreateDialog);
    drafts = [];
    dismissed = 0;
    fixture.componentInstance.submitted.subscribe((draft: ApiTokenDraft) => drafts.push(draft));
    fixture.componentInstance.dismissed.subscribe(() => (dismissed += 1));
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('opens on the form with 30 days and tasks:read', () => {
    expect(dialog()?.textContent).toContain('Create a token');
    expect(dialog()?.textContent).toContain('Grant only the scopes you need.');
    expect(dialog()?.querySelector('[role="combobox"]')?.textContent).toContain('30 days');
    const boxes: HTMLElement[] = [
      ...(dialog()?.querySelectorAll<HTMLElement>('[role="checkbox"]') ?? []),
    ];
    expect(boxes.map((box: HTMLElement) => box.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ]);
  });

  it('keeps Create enabled, shows the name error and focuses the field on an invalid submit', async () => {
    typeName('   ');
    const submit: HTMLElement | null = byTestId('token-submit');
    expect(submit?.hasAttribute('disabled')).toBe(false);

    submit?.click();
    await fixture.whenStable();

    expect(alerts()).toEqual(['Enter a name for the token.']);
    expect(document.activeElement?.id).toBe('token-name');
    expect(drafts).toEqual([]);
  });

  it('asks for a scope when none is checked', async () => {
    typeName('GitLab sync');
    dialog()?.querySelector<HTMLElement>('[role="checkbox"]')?.click();
    await fixture.whenStable();

    byTestId('token-submit')?.click();
    await fixture.whenStable();

    expect(alerts()).toEqual(['Choose at least one scope.']);
    expect(drafts).toEqual([]);
  });

  it('submits the trimmed name with the checked scopes in the contract order', async () => {
    typeName('  GitLab sync  ');
    const boxes: HTMLElement[] = [
      ...(dialog()?.querySelectorAll<HTMLElement>('[role="checkbox"]') ?? []),
    ];
    boxes[2]?.click();
    await fixture.whenStable();

    byTestId('token-submit')?.click();
    await vi.waitFor(() => {
      expect(drafts).toEqual([
        { name: 'GitLab sync', scopes: ['tasks:read', 'members:read'], expiration: '30-days' },
      ]);
    });
  });

  it('shows the secret once with copy, and reports the close', async () => {
    const secret: string = `cw_pat_${'D'.repeat(36)}`;
    let copies: number = 0;
    fixture.componentInstance.copyRequested.subscribe(() => (copies += 1));
    fixture.componentRef.setInput('secret', secret);
    await fixture.whenStable();

    expect(dialog()?.textContent).toContain('Token created');
    expect(dialog()?.textContent).toContain('Copy it now: it will not be shown again.');
    const field: HTMLInputElement | null =
      dialog()?.querySelector<HTMLInputElement>('[data-testid="token-secret"]') ?? null;
    expect(field?.value).toBe(secret);
    expect(field?.readOnly).toBe(true);
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(field);
    });

    byTestId('token-copy')?.click();
    byTestId('token-done')?.click();

    expect(copies).toBe(1);
    expect(dismissed).toBe(1);
  });

  it('reports that it detached only once the closed dialog left the screen', async () => {
    let detached: number = 0;
    fixture.componentInstance.detached.subscribe(() => {
      detached += 1;
      expect(dialog()).toBeNull();
    });
    fixture.componentRef.setInput('secret', `cw_pat_${'F'.repeat(36)}`);
    await fixture.whenStable();
    expect(detached).toBe(0);

    fixture.componentRef.setInput('open', false);

    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(detached).toBe(1);
    });
  });
});
