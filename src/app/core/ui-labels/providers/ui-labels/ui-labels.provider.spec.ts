import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwCommandFooter, provideCwCommandLabels } from '@cadenway/ui/components/command';
import { injectCwKbdLabels } from '@cadenway/ui/components/kbd';
import { injectCwPriorityLabels } from '@cadenway/ui/components/priority-icon';
import { describe, expect, it } from 'vitest';

import { provideCadenwayUiLabels } from './ui-labels.provider';

/**
 * Component FooterHost
 *
 * @description
 * Renders the command palette footer, whose key names come from the kbd labels.
 */
@Component({
  selector: 'cw-footer-host',
  imports: [CwCommandFooter],
  providers: [
    provideCwCommandLabels({ navigateLabel: 'navigate', runLabel: 'open', closeLabel: 'close' }),
  ],
  template: '<cw-command-footer />',
})
class FooterHost {}

describe('provideCadenwayUiLabels', () => {
  it('names the keys in English instead of the bricks’ French defaults', () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayUiLabels()] });

    const labels: ReturnType<typeof injectCwKbdLabels> = TestBed.runInInjectionContext(() =>
      injectCwKbdLabels(),
    );

    expect(labels.enter).toBe('Enter');
    expect(labels.escape).toBe('Esc');
    expect(labels.then).toBe('then');
  });

  it('shows English key names in the command palette footer', async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayUiLabels()] });
    const fixture: ReturnType<typeof TestBed.createComponent<FooterHost>> =
      TestBed.createComponent(FooterHost);
    await fixture.whenStable();

    const keys: string[] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('kbd'),
      (key: Element): string => key.textContent.trim(),
    );

    expect(keys).toContain('Enter');
    expect(keys).toContain('Esc');
  });

  it('gives the priority words in English', () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayUiLabels()] });

    const labels: ReturnType<typeof injectCwPriorityLabels> = TestBed.runInInjectionContext(() =>
      injectCwPriorityLabels(),
    );

    expect(labels.urgente).toBe('Urgent');
    expect(labels.basse).toBe('Low');
  });
});
