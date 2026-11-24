import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type FieldTree, form, required, submit } from '@angular/forms/signals';
import { describe, expect, it, vi } from 'vitest';

import { focusFirstError, serverError } from './form-focus.util';

describe('form focus helpers', () => {
  it('focuses the first field holding an error', () => {
    const model: WritableSignal<{ email: string; password: string }> = signal({
      email: '',
      password: '',
    });
    const fields: FieldTree<{ email: string; password: string }> = TestBed.runInInjectionContext(
      () =>
        form(model, (path) => {
          required(path.email);
          required(path.password);
        }),
    );
    const focus: ReturnType<typeof vi.spyOn> = vi.spyOn(fields.email(), 'focusBoundControl');

    focusFirstError(fields);

    expect(focus).toHaveBeenCalledOnce();
  });

  it('shows a gateway refusal on its field after submit', async () => {
    const model: WritableSignal<{ email: string }> = signal({ email: 'camille@ateliernord.fr' });
    const fields: FieldTree<{ email: string }> = TestBed.runInInjectionContext(() => form(model));

    await submit(fields, () => Promise.resolve(serverError(fields.email, 'Adresse déjà utilisée')));

    expect(
      fields
        .email()
        .errors()
        .map((error) => error.message),
    ).toEqual(['Adresse déjà utilisée']);
  });
});
