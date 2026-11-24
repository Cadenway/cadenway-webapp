import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { ShortcutsService } from './shortcuts.service';

describe('ShortcutsService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });
  it('matches modifiers and uses the newest registration until destroyed', () => {
    const service: ShortcutsService = TestBed.inject(ShortcutsService);
    const first: Mock = vi.fn();
    const second: Mock = vi.fn();
    let destroy: () => void = () => undefined;
    const scope: DestroyRef = {
      onDestroy: (callback: () => void) => {
        destroy = callback;
        return () => undefined;
      },
      destroyed: false,
    };
    const unregister: () => void = service.register({ keys: 'mod+k', handler: first }, scope);
    service.register({ keys: 'mod+k', handler: second }, scope);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }),
    );
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    destroy();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
    );
    expect(first).toHaveBeenCalledOnce();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true }),
    );
    expect(first).toHaveBeenCalledOnce();
    unregister();
  });
  it('ignores editable targets unless allowed', () => {
    const service: ShortcutsService = TestBed.inject(ShortcutsService);
    const handler: Mock = vi.fn();
    service.register({ keys: 'n', handler }, TestBed.inject(DestroyRef));
    const input: HTMLInputElement = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
    input.remove();
  });
  it('allows eligible editable events and ignores prevented or composing events', () => {
    const service: ShortcutsService = TestBed.inject(ShortcutsService);
    const handler: Mock = vi.fn();
    service.register({ keys: '?', handler, allowInEditable: true }, TestBed.inject(DestroyRef));
    const input: HTMLInputElement = document.createElement('input');
    document.body.append(input);
    const event: KeyboardEvent = new KeyboardEvent('keydown', {
      key: '?',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: '?', isComposing: true, bubbles: true }),
    );
    const prevented: KeyboardEvent = new KeyboardEvent('keydown', {
      key: '?',
      bubbles: true,
      cancelable: true,
    });
    prevented.preventDefault();
    input.dispatchEvent(prevented);
    expect(handler).toHaveBeenCalledOnce();
    input.remove();
  });
  it('handles layout keys, AltGr, repeats and the single-key preference', () => {
    const service: ShortcutsService = TestBed.inject(ShortcutsService);
    const handler: Mock = vi.fn();
    const unregister: () => void = service.register(
      { keys: 'mod+k', handler },
      TestBed.inject(DestroyRef),
    );
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '\u043b', code: 'KeyK', ctrlKey: true }),
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, repeat: true }));
    expect(handler).toHaveBeenCalledOnce();
    unregister();
    const single: () => void = service.register({ keys: '@', handler }, TestBed.inject(DestroyRef));
    const event: KeyboardEvent = new KeyboardEvent('keydown', {
      key: '@',
      ctrlKey: true,
      altKey: true,
    });
    vi.spyOn(event, 'getModifierState').mockReturnValue(true);
    document.dispatchEvent(event);
    expect(handler).toHaveBeenCalledTimes(2);
    service.setSingleKeyShortcutsEnabled(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '@' }));
    expect(handler).toHaveBeenCalledTimes(2);
    single();
  });
});
