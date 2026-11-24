import {
  computed,
  DestroyRef,
  inject,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

/**
 * Class Countdown
 *
 * @description
 * A whole-second countdown for "resend" buttons (30 s for codes, 45 s for reset links, as in
 * `Otp.dc.html` and `MotDePasseOublie.dc.html`). It ticks once a second, stops at zero and stops
 * for good when the injection context that created it is destroyed. Create it in an injection
 * context.
 */
export class Countdown {
  // #region Properties
  /**
   * Property remaining
   *
   * @description
   * Seconds left, zero when the action is available.
   *
   * @type {Signal<number>}
   * @readonly
   */
  public readonly remaining: Signal<number>;

  /**
   * Property running
   *
   * @description
   * Whether seconds are left.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  public readonly running: Signal<boolean>;

  /**
   * Property label
   *
   * @description
   * Seconds left as `m:ss`, as the mockup prints them ("0:29").
   *
   * @type {Signal<string>}
   * @readonly
   */
  public readonly label: Signal<string>;

  /**
   * Property seconds
   *
   * @description
   * Writable seconds left.
   *
   * @type {WritableSignal<number>}
   * @readonly
   */
  private readonly seconds: WritableSignal<number> = signal(0);

  /**
   * Property timer
   *
   * @description
   * Interval of the running countdown, or undefined.
   *
   * @type {ReturnType<typeof setInterval> | undefined}
   */
  private timer: ReturnType<typeof setInterval> | undefined;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the countdown to the lifetime of the current injection context.
   *
   * @constructor
   */
  public constructor() {
    this.remaining = this.seconds.asReadonly();
    this.running = computed(() => this.seconds() > 0);
    this.label = computed(() => {
      const left: number = this.seconds();
      return `${String(Math.floor(left / 60))}:${String(left % 60).padStart(2, '0')}`;
    });
    inject(DestroyRef).onDestroy(() => {
      this.stop();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method start
   *
   * @description
   * Restarts the countdown from a number of seconds.
   *
   * @param {number} seconds - Whole seconds to count down from.
   */
  public start(seconds: number): void {
    this.stop();
    this.seconds.set(Math.max(0, Math.round(seconds)));
    if (this.seconds() === 0) return;
    this.timer = setInterval(() => {
      this.seconds.update((left: number): number => left - 1);
      if (this.seconds() <= 0) this.stop();
    }, 1_000);
  }

  /**
   * Method stop
   *
   * @description
   * Stops ticking, keeping the seconds left.
   */
  public stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }
  // #endregion
}
