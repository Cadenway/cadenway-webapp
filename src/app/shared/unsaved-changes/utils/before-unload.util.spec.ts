import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { warnBeforeUnload } from './before-unload.util';

/**
 * Component DirtyPage
 *
 * @description
 * A page that warns before unload while its static flag is set.
 */
@Component({ selector: 'cw-dirty-page', template: '' })
class DirtyPage {
  // #region Properties
  /**
   * Property dirty
   *
   * @description
   * Whether the page holds unsaved changes.
   *
   * @type {boolean}
   */
  public static dirty: boolean = false;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Registers the warning.
   *
   * @constructor
   */
  public constructor() {
    warnBeforeUnload(() => DirtyPage.dirty);
  }
  // #endregion
}

/**
 * Function unload
 *
 * @description
 * Dispatches a cancelable `beforeunload` event on the window.
 *
 * @returns {Event} The dispatched event.
 */
function unload(): Event {
  const event: Event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe('warnBeforeUnload', () => {
  it('asks the browser to confirm only while the page is dirty', () => {
    DirtyPage.dirty = false;
    TestBed.createComponent(DirtyPage);

    expect(unload().defaultPrevented).toBe(false);
    DirtyPage.dirty = true;
    expect(unload().defaultPrevented).toBe(true);
  });

  it('stops warning once the page is destroyed', () => {
    DirtyPage.dirty = true;
    TestBed.createComponent(DirtyPage).destroy();

    expect(unload().defaultPrevented).toBe(false);
  });
});
