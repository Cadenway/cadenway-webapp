import { DOCUMENT } from '@angular/common';
import {
  computed,
  DestroyRef,
  inject,
  Service,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import type { ResolvedTheme, ThemePreference } from '../../models/theme/theme.type';

/**
 * Service ThemeService
 *
 * @description
 * Synchronizes the selected color scheme with the document and other tabs.
 */
@Service()
export class ThemeService {
  // #region Properties
  /**
   * Property document
   *
   * @description
   * Document whose theme is updated.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property destroyRef
   *
   * @description
   * Lifetime of event listeners.
   *
   * @type {DestroyRef}
   * @readonly
   */
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /**
   * Property media
   *
   * @description
   * System color scheme query.
   *
   * @type {MediaQueryList | undefined}
   * @readonly
   */
  private readonly media: MediaQueryList | undefined = this.document.defaultView?.matchMedia(
    '(prefers-color-scheme: dark)',
  );

  /**
   * Property dark
   *
   * @description
   * Current system color scheme.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  private readonly dark: WritableSignal<boolean> = signal(this.media?.matches ?? false);

  /**
   * Property selected
   *
   * @description
   * Selected user preference.
   *
   * @type {WritableSignal<ThemePreference>}
   * @readonly
   */
  private readonly selected: WritableSignal<ThemePreference> = signal(this.read());

  /**
   * Property preference
   *
   * @description
   * Current user preference.
   *
   * @type {Signal<ThemePreference>}
   * @readonly
   */
  public readonly preference: Signal<ThemePreference> = this.selected.asReadonly();

  /**
   * Property resolved
   *
   * @description
   * Current effective color scheme.
   *
   * @type {Signal<ResolvedTheme>}
   * @readonly
   */
  public readonly resolved: Signal<ResolvedTheme> = computed(() =>
    this.selected() === 'system'
      ? this.dark()
        ? 'dark'
        : 'light'
      : (this.selected() as ResolvedTheme),
  );
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Starts synchronization and cleans up listeners when destroyed.
   *
   * @constructor
   */
  public constructor() {
    const update: () => void = (): void => {
      this.dark.set(this.media?.matches ?? false);
      this.apply();
    };
    const storage: (event: StorageEvent) => void = (event: StorageEvent): void => {
      if (event.key === 'cadenway-theme' || event.key === null) {
        this.selected.set(this.read());
        this.apply();
      }
    };
    this.media?.addEventListener('change', update);
    this.document.defaultView?.addEventListener('storage', storage);
    this.destroyRef.onDestroy(() => {
      this.media?.removeEventListener('change', update);
      this.document.defaultView?.removeEventListener('storage', storage);
    });
    this.apply();
  }
  // #endregion

  // #region Methods
  /**
   * Method set
   *
   * @description
   * Persists and applies a user preference.
   * @param {ThemePreference} preference - Preference to apply.
   * @param {{ readonly x: number; readonly y: number } | undefined} origin - Optional animation origin.
   */
  public set(
    preference: ThemePreference,
    origin?: { readonly x: number; readonly y: number },
  ): void {
    const previous: ResolvedTheme = this.resolved();
    this.selected.set(preference);
    if (this.resolved() === previous) return;
    const change: () => void = (): void => {
      try {
        if (preference === 'system')
          this.document.defaultView?.localStorage.removeItem('cadenway-theme');
        else this.document.defaultView?.localStorage.setItem('cadenway-theme', preference);
      } catch {
        /* Storage may be unavailable. */
      }
      this.apply();
    };
    const view: Window | null = this.document.defaultView;
    if (
      !view ||
      typeof this.document.startViewTransition !== 'function' ||
      view.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      change();
      return;
    }
    const position: string = origin ? `${String(origin.x)}px ${String(origin.y)}px` : '50% 100%';
    const transition: ViewTransition = this.document.startViewTransition(change);
    void transition.ready
      .then(() =>
        this.document.documentElement.animate(
          {
            clipPath: [`circle(0% at ${position})`, `circle(150% at ${position})`],
            filter: ['blur(8px)', 'blur(0px)'],
          },
          {
            duration: 700,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        ),
      )
      .catch(() => undefined);
  }

  /**
   * Method toggle
   *
   * @description
   * Switches from the effective theme to its opposite.
   * @param {{ readonly x: number; readonly y: number } | undefined} origin - Optional animation origin.
   */
  public toggle(origin?: { readonly x: number; readonly y: number }): void {
    this.set(this.resolved() === 'dark' ? 'light' : 'dark', origin);
  }

  /**
   * Method read
   *
   * @description
   * Reads a stored preference, tolerating inaccessible storage.
   * @returns {ThemePreference} Stored light or dark preference, or system when absent or inaccessible.
   */
  private read(): ThemePreference {
    try {
      const value: string | null | undefined =
        this.document.defaultView?.localStorage.getItem('cadenway-theme');
      return value === 'light' || value === 'dark' ? value : 'system';
    } catch {
      return 'system';
    }
  }

  /**
   * Method apply
   *
   * @description
   * Applies the effective scheme to the document.
   */
  private apply(): void {
    this.document.documentElement.dataset['theme'] = this.resolved();
  }
  // #endregion
}
