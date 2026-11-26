import {
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  model,
  type ModelSignal,
  type Signal,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwDialog,
  CwDialogDescription,
  CwDialogFooter,
  CwDialogHeader,
  CwDialogTitle,
  provideCwDialogLabels,
} from '@cadenway/ui/components/dialog';
import { CwInput } from '@cadenway/ui/components/input';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { CwSwitch } from '@cadenway/ui/components/switch';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import {
  defaultStatusOptions,
  STATUS_CATEGORY_LABELS,
  STATUS_HINTS,
  STATUS_LABELS,
  type StatusOption,
} from '@features/task';

import { STATUS_ORDER } from '../../../constants/statuses/statuses.constants';
import type { StatusKey } from '../../../models/list-view-config/list-view-config.interface';
import type { SpaceDetails, SpaceStatusOption } from '../../../models/space/space.interface';
import {
  REQUIRED_STATUSES,
  STATUS_NAME_MAX,
  type SpaceStatusesOutcome,
  SpaceStatusesStore,
} from '../../../state/space-statuses/space-statuses.store';

/**
 * Interface StatusRow
 *
 * @description
 * One row of the dialog: a status with its heading, name field and switch.
 */
interface StatusRow {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * The status.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly key: StatusKey;

  /**
   * Property heading
   *
   * @description
   * Its category's heading when it is the first status of its category, else null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly heading: string | null;

  /**
   * Property name
   *
   * @description
   * The name the space gives it, empty for the default label.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property base
   *
   * @description
   * Its default label, the field's placeholder.
   *
   * @type {string}
   * @readonly
   */
  readonly base: string;

  /**
   * Property hint
   *
   * @description
   * Its one-line meaning.
   *
   * @type {string}
   * @readonly
   */
  readonly hint: string;

  /**
   * Property used
   *
   * @description
   * Whether the space uses it.
   *
   * @type {boolean}
   * @readonly
   */
  readonly used: boolean;

  /**
   * Property required
   *
   * @description
   * Whether the space must use it (`todo`, `done`).
   *
   * @type {boolean}
   * @readonly
   */
  readonly required: boolean;

  /**
   * Property nameLabel
   *
   * @description
   * Accessible name of the field (`Status name To do`).
   *
   * @type {string}
   * @readonly
   */
  readonly nameLabel: string;

  /**
   * Property switchLabel
   *
   * @description
   * Accessible name and tooltip of the switch (`Stop using In review`, `Use In review`).
   *
   * @type {string}
   * @readonly
   */
  readonly switchLabel: string;
  // #endregion
}

/**
 * Constant CATEGORY_BY_KEY
 *
 * @description
 * The category of each status, which never changes with the space.
 *
 * @type {ReadonlyMap<StatusKey, StatusOption['category']>}
 */
const CATEGORY_BY_KEY: ReadonlyMap<StatusKey, StatusOption['category']> = new Map(
  defaultStatusOptions().map((option: StatusOption): [StatusKey, StatusOption['category']] => [
    option.key,
    option.category,
  ]),
);

/**
 * Function switchLabel
 *
 * @description
 * The name of a status's switch, as the mockup writes it (`usedLabel`, `App.dc.html` line 8603).
 *
 * @param {string} label - The status's default label.
 * @param {boolean} used - Whether the space uses it.
 * @param {boolean} required - Whether it must stay used.
 * @returns {string} The name.
 */
function switchLabel(label: string, used: boolean, required: boolean): string {
  if (required) {
    return $localize`:@@spaces.statuses.stop-using-required:Stop using ${label}:label: (required)`;
  }
  return used
    ? $localize`:@@spaces.statuses.stop-using:Stop using ${label}:label:`
    : $localize`:@@spaces.statuses.use:Use ${label}:label:`;
}

/**
 * Component SpaceStatusesDialog
 *
 * @description
 * `Space statuses` (`App.dc.html` lines 3302-3317, logic 8587-8608): the ten statuses of the space
 * by category, each with its icon, a name field (the default label as placeholder, 24 characters
 * at most), its hint (from 640 px) and a switch to stop using it; `To do` and `Done` stay used.
 * A switch and `Reset to defaults` write at once; a name is written when the field changes (on
 * blur or Enter), so the mockup's per-keystroke write sends one request per edit. Each change shows
 * at once and, when it ends unsaved, the field or switch shows the recorded value again with the
 * failure toast (one at a time). The
 * controls are disabled when the caller may not edit the space. Hosted deferred by the list page,
 * which binds `open` (two-way; `Done` and the close button set it to false) and `space`, the
 * sidebar's read with its version and rights, or null while it is read (skeleton rows). The dialog
 * provides its `SpaceStatusesStore`.
 */
@Component({
  selector: 'cw-space-statuses-dialog',
  imports: [
    CwButton,
    CwDialog,
    CwDialogDescription,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    CwInput,
    CwSkeleton,
    CwStatusIcon,
    CwSwitch,
    NgIcon,
  ],
  providers: [
    SpaceStatusesStore,
    provideCwDialogLabels(() => ({ close: $localize`:@@spaces.labels.close:Close` })),
  ],
  templateUrl: './space-statuses-dialog.component.html',
})
export class SpaceStatusesDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog shows; `[(open)]`.
   *
   * @type {ModelSignal<boolean>}
   * @readonly
   */
  public readonly open: ModelSignal<boolean> = model(false);

  /**
   * Property space
   *
   * @description
   * The space the dialog is about, or null while it is read.
   *
   * @type {InputSignal<SpaceDetails | null>}
   * @readonly
   */
  public readonly space: InputSignal<SpaceDetails | null> = input<SpaceDetails | null>(null);

  /**
   * Property store
   *
   * @description
   * The statuses shown and their writes.
   *
   * @type {InstanceType<typeof SpaceStatusesStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof SpaceStatusesStore> = inject(SpaceStatusesStore);

  /**
   * Property nameMax
   *
   * @description
   * Longest name a field takes.
   *
   * @type {number}
   * @readonly
   */
  protected readonly nameMax: number = STATUS_NAME_MAX;

  /**
   * Property placeholders
   *
   * @description
   * Rows of the skeleton shown while the space is read.
   *
   * @type {readonly number[]}
   * @readonly
   */
  protected readonly placeholders: readonly number[] = [0, 1, 2, 3, 4, 5];

  /**
   * Property title
   *
   * @description
   * `Statuses of “Product”`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly title: Signal<string> = computed((): string => {
    const name: string = this.space()?.name ?? '';
    return $localize`:@@spaces.statuses.title:Statuses of “${name}:name:”`;
  });

  /**
   * Property description
   *
   * @description
   * The dialog's text with the count of statuses used.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly description: Signal<string> = computed((): string => {
    const used: number = this.store.usedCount();
    const total: number = STATUS_ORDER.length;
    return $localize`:@@spaces.statuses.description:Rename the statuses to match the team’s vocabulary, or hide the ones you do not use. The categories do not change: the counts stay accurate. ${used}:used: statuses used out of ${total}:total:.`;
  });

  /**
   * Property loaded
   *
   * @description
   * Whether the statuses of the bound space are shown.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly loaded: Signal<boolean> = computed(
    (): boolean => this.space() !== null && this.store.spaceId() === this.space()?.id,
  );

  /**
   * Property rows
   *
   * @description
   * The statuses in workflow order, with a heading before the first status of each category.
   *
   * @type {Signal<readonly StatusRow[]>}
   * @readonly
   */
  protected readonly rows: Signal<readonly StatusRow[]> = computed((): readonly StatusRow[] =>
    this.store
      .statuses()
      .map((status: SpaceStatusOption, index: number, all: readonly SpaceStatusOption[]) => {
        const category: StatusOption['category'] = CATEGORY_BY_KEY.get(status.key) ?? 'open';
        const previous: StatusOption['category'] | undefined =
          index === 0 ? undefined : CATEGORY_BY_KEY.get(all[index - 1].key);
        const base: string = STATUS_LABELS[status.key];
        const required: boolean = REQUIRED_STATUSES.has(status.key);
        return {
          key: status.key,
          heading: previous === category ? null : STATUS_CATEGORY_LABELS[category],
          name: status.name ?? '',
          base,
          hint: STATUS_HINTS[status.key],
          used: !status.hidden,
          required,
          nameLabel: $localize`:@@spaces.statuses.name-label:Status name ${base}:label:`,
          switchLabel: switchLabel(base, !status.hidden, required),
        };
      }),
  );

  /**
   * Property toasts
   *
   * @description
   * Shows the failure of a write.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property failureToast
   *
   * @description
   * The failure toast shown, replaced by the next failure so refusals do not pile up.
   *
   * @type {string | null}
   */
  private failureToast: string | null = null;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Follows the bound space.
   *
   * @constructor
   */
  public constructor() {
    this.store.follow(this.space);
  }
  // #endregion

  // #region Methods
  /**
   * Method rename
   *
   * @description
   * Records the name of a field once it changes, then shows the name as the store holds it (trimmed,
   * or empty for the default label). A change that ends unsaved writes the recorded name back into
   * the field, which its binding may not do when the refusal comes before the next render.
   *
   * @param {StatusKey} key - The status.
   * @param {HTMLInputElement} field - Its name field.
   */
  protected rename(key: StatusKey, field: HTMLInputElement): void {
    this.report(this.store.rename(key, field.value), (): void => {
      field.value = this.statusOf(key)?.name ?? '';
    });
    field.value = this.statusOf(key)?.name ?? '';
  }

  /**
   * Method setUsed
   *
   * @description
   * Uses a status again or stops using it. A change that ends unsaved sets the switch back to the
   * recorded state, which its binding may not do when the refusal comes before the next render.
   *
   * @param {StatusKey} key - The status.
   * @param {boolean} used - Whether the space uses it.
   * @param {CwSwitch} control - Its switch.
   */
  protected setUsed(key: StatusKey, used: boolean, control: CwSwitch): void {
    this.report(this.store.setUsed(key, used), (): void => {
      control.checked.set(!(this.statusOf(key)?.hidden ?? false));
    });
  }

  /**
   * Method reset
   *
   * @description
   * Puts back every default (`Reset to defaults`).
   */
  protected reset(): void {
    this.report(this.store.reset());
  }

  /**
   * Method close
   *
   * @description
   * Closes the dialog (`Done`); writes in flight go on.
   */
  protected close(): void {
    this.open.set(false);
  }

  /**
   * Method statusOf
   *
   * @description
   * A status as the store shows it.
   *
   * @param {StatusKey} key - The status.
   * @returns {SpaceStatusOption | undefined} The status.
   */
  private statusOf(key: StatusKey): SpaceStatusOption | undefined {
    return this.store.statuses().find((status: SpaceStatusOption): boolean => status.key === key);
  }

  /**
   * Method report
   *
   * @description
   * Shows the toast of a change that ends unsaved, in place of the previous one: refused, or not
   * confirmed when the write and the read that follows got no answer. `restore` puts the control
   * back to the recorded value first.
   *
   * @param {Promise<SpaceStatusesOutcome>} write - The change's outcome.
   * @param {(() => void) | undefined} restore - Puts the control back to the recorded value.
   */
  private report(write: Promise<SpaceStatusesOutcome>, restore?: () => void): void {
    void write.then((outcome: SpaceStatusesOutcome): void => {
      if (outcome === 'saved') return;
      restore?.();
      if (this.failureToast !== null) this.toasts.dismiss(this.failureToast);
      this.failureToast = this.toasts.error(
        outcome === 'refused'
          ? $localize`:@@spaces.statuses.save-failed:The statuses could not be saved`
          : $localize`:@@spaces.statuses.save-unknown:The change could not be confirmed. Check the statuses once the connection is back.`,
      );
    });
  }
  // #endregion
}
