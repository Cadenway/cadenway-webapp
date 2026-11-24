import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { HomePage } from './home-page.component';

/**
 * Function render
 *
 * @description
 * Renders the home page for Camille with a `?notice=` value.
 *
 * @param {string | undefined} notice - The notice query parameter.
 * @returns {Promise<ComponentFixture<HomePage>>} The page.
 */
async function render(notice: string | undefined): Promise<ComponentFixture<HomePage>> {
  TestBed.configureTestingModule({
    imports: [HomePage],
    providers: [
      {
        provide: WORKSPACE_CONTEXT,
        useValue: { user: () => ({ firstName: 'Camille' }) },
      },
    ],
  });
  const fixture: ComponentFixture<HomePage> = TestBed.createComponent(HomePage);
  fixture.componentRef.setInput('notice', notice);
  await fixture.whenStable();
  return fixture;
}

describe('HomePage', () => {
  it('greets the person without a notice', async () => {
    const host: HTMLElement = (await render(undefined)).nativeElement as HTMLElement;

    expect(host.querySelector('h1')?.textContent.trim()).toBe('Bonjour Camille');
    expect(host.querySelector('cw-alert')).toBeNull();
  });

  it('says the new organization’s logo could not be uploaded until dismissed', async () => {
    const fixture: ComponentFixture<HomePage> = await render('logo-upload-failed');
    const host: HTMLElement = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('cw-alert')?.textContent).toContain(
      'L’organisation a été créée, mais son logo n’a pas pu être importé.',
    );
    host.querySelector<HTMLButtonElement>('cw-alert button')?.click();
    await fixture.whenStable();
    expect(host.querySelector('cw-alert')).toBeNull();
  });
});
