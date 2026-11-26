import {
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  LOCALE_ID,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { NgIcon } from '@ng-icons/core';

import type {
  TaskGitChecks,
  TaskGitLink,
  TaskGitLinkSource,
  TaskGitLinkState,
} from '../../../models/task-git-link/task-git-link.interface';
import { initialsOf } from '../../../utils/person/person.util';
import {
  firstName,
  relativeInstant,
} from '../../../utils/task-detail-sections/task-detail-sections.util';

/**
 * Interface GitStateLook
 *
 * @description
 * How a lifecycle state is drawn (`GIT_STATE` of `App.dc.html`).
 */
interface GitStateLook {
  // #region Properties
  /**
   * Property icon
   *
   * @description
   * Its Phosphor icon.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property tone
   *
   * @description
   * The icon's color class.
   *
   * @type {string}
   * @readonly
   */
  readonly tone: string;
  // #endregion
}

/**
 * Constant STATE_LOOKS
 *
 * @description
 * Icon and tone of each state, as the mockup draws them.
 *
 * @type {Readonly<Record<TaskGitLinkState, GitStateLook>>}
 */
const STATE_LOOKS: Readonly<Record<TaskGitLinkState, GitStateLook>> = {
  branch: { icon: 'phosphorGitBranchBold', tone: 'text-muted-foreground' },
  draft: { icon: 'phosphorGitPullRequestBold', tone: 'text-muted-foreground' },
  open: { icon: 'phosphorGitPullRequestBold', tone: 'text-jade' },
  merged: { icon: 'phosphorGitMergeBold', tone: 'text-amethyste' },
  closed: { icon: 'phosphorGitPullRequestBold', tone: 'text-grenat' },
};

/**
 * Interface GitChecksRow
 *
 * @description
 * The checks of a row in words.
 */
interface GitChecksRow {
  // #region Properties
  /**
   * Property icon
   *
   * @description
   * Icon of the outcome.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property tone
   *
   * @description
   * Color (and spin while running) of the icon.
   *
   * @type {string}
   * @readonly
   */
  readonly tone: string;

  /**
   * Property label
   *
   * @description
   * The outcome (`Checks passed`, `1 check failed`).
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property short
   *
   * @description
   * What the row shows next to the icon (`11/12`, `Running`), or null without counts.
   *
   * @type {string | null}
   * @readonly
   */
  readonly short: string | null;

  /**
   * Property title
   *
   * @description
   * The tooltip and screen reader text: the outcome and, once completed, when.
   *
   * @type {string}
   * @readonly
   */
  readonly title: string;
  // #endregion
}

/**
 * Interface GitLinkRow
 *
 * @description
 * One link as the Development panel writes it (`gitRows` of `App.dc.html`).
 */
export interface GitLinkRow {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the link.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property icon
   *
   * @description
   * Icon of its kind and state.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property tone
   *
   * @description
   * Color class of that icon.
   *
   * @type {string}
   * @readonly
   */
  readonly tone: string;

  /**
   * Property title
   *
   * @description
   * The request's title, or the branch name.
   *
   * @type {string}
   * @readonly
   */
  readonly title: string;

  /**
   * Property titleClass
   *
   * @description
   * Weight and face of the title: a branch name is set in monospace, as in the mockup.
   *
   * @type {string}
   * @readonly
   */
  readonly titleClass: string;

  /**
   * Property number
   *
   * @description
   * `#214` on GitHub, `!31` on GitLab, or null for a branch.
   *
   * @type {string | null}
   * @readonly
   */
  readonly number: string | null;

  /**
   * Property url
   *
   * @description
   * Address on the provider the title opens in a new tab, or null until recorded.
   *
   * @type {string | null}
   * @readonly
   */
  readonly url: string | null;

  /**
   * Property state
   *
   * @description
   * The state chip's word.
   *
   * @type {string}
   * @readonly
   */
  readonly state: string;

  /**
   * Property checks
   *
   * @description
   * The checks, or null when none are recorded.
   *
   * @type {GitChecksRow | null}
   * @readonly
   */
  readonly checks: GitChecksRow | null;

  /**
   * Property review
   *
   * @description
   * Whether `Review requested` shows (a request not merged with reviewers requested).
   *
   * @type {boolean}
   * @readonly
   */
  readonly review: boolean;

  /**
   * Property logo
   *
   * @description
   * Logo of the host.
   *
   * @type {string}
   * @readonly
   */
  readonly logo: string;

  /**
   * Property repository
   *
   * @description
   * Owner and name of the repository, or null until recorded.
   *
   * @type {string | null}
   * @readonly
   */
  readonly repository: string | null;

  /**
   * Property additions
   *
   * @description
   * Lines added (`+418`), or null without a diff size.
   *
   * @type {string | null}
   * @readonly
   */
  readonly additions: string | null;

  /**
   * Property deletions
   *
   * @description
   * Lines deleted (`−132`), or null without a diff size.
   *
   * @type {string | null}
   * @readonly
   */
  readonly deletions: string | null;

  /**
   * Property initials
   *
   * @description
   * Initials of the author, or null when unknown.
   *
   * @type {string | null}
   * @readonly
   */
  readonly initials: string | null;

  /**
   * Property author
   *
   * @description
   * First name of the author (or their login), or null when unknown.
   *
   * @type {string | null}
   * @readonly
   */
  readonly author: string | null;

  /**
   * Property when
   *
   * @description
   * When the link was recorded, relative to now.
   *
   * @type {string}
   * @readonly
   */
  readonly when: string;

  /**
   * Property source
   *
   * @description
   * Where the key was detected (`detected: CAD-482 in the branch`), or null when unknown.
   *
   * @type {string | null}
   * @readonly
   */
  readonly source: string | null;
  // #endregion
}

/**
 * Component TaskDevelopment
 *
 * @description
 * The `Development` section of `Details` (`App.dc.html` lines 2192-2268), presentational: the
 * heading with the count of links listed (`50+` while older ones remain), the rows (state icon,
 * the request's title or the branch name linking to the provider in a new tab with its number,
 * the state chip, the checks with their counts and completion time in the tooltip,
 * `Review requested`, the repository with its host's logo, the diff size, the author and when
 * the link was recorded, where the key was detected), `Show more` while older links remain, the
 * mockup's empty state once a read succeeded with no link, the loading lines while the first read
 * runs, an inline error with `Retry` (`retried`) when the links could not be read (above the rows
 * already shown), and the footer hint whose key is a `Copy the identifier` button (`keyCopied`).
 * `Link a PR` and `Create a branch` are left out until their routes exist (gap B5); the row
 * menu and the commit list are left out with them.
 */
@Component({
  selector: 'cw-task-development',
  imports: [CwButton, NgIcon],
  host: { class: 'flex flex-col gap-2 px-2' },
  templateUrl: './task-development.component.html',
})
export class TaskDevelopment {
  // #region Properties
  /**
   * Property taskKey
   *
   * @description
   * Key of the open task.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly taskKey: InputSignal<string> = input.required<string>();

  /**
   * Property links
   *
   * @description
   * The links read, newest first.
   *
   * @type {InputSignal<readonly TaskGitLink[]>}
   * @readonly
   */
  public readonly links: InputSignal<readonly TaskGitLink[]> = input<readonly TaskGitLink[]>([]);

  /**
   * Property ready
   *
   * @description
   * Whether a first page was read, so no link is the empty state.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly ready: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property loading
   *
   * @description
   * Whether the links are being read.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly loading: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property failed
   *
   * @description
   * Whether the links could not be read.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly failed: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property hasMore
   *
   * @description
   * Whether older links remain.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly hasMore: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property loadingMore
   *
   * @description
   * Whether a later page is being read.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly loadingMore: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property moreFailed
   *
   * @description
   * Whether the last later page read failed.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly moreFailed: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property keyCopied
   *
   * @description
   * Emits when the key is clicked, to copy it.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly keyCopied: OutputEmitterRef<void> = output();

  /**
   * Property retried
   *
   * @description
   * Emits when `Retry` is pressed after the links could not be read.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly retried: OutputEmitterRef<void> = output();

  /**
   * Property moreLoaded
   *
   * @description
   * Emits when `Show more` (or its `Retry`) is pressed.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly moreLoaded: OutputEmitterRef<void> = output();

  /**
   * Property count
   *
   * @description
   * The heading's count of links listed, with `+` while older ones remain.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly count: Signal<string> = computed(
    (): string => `${this.links().length.toString()}${this.hasMore() ? '+' : ''}`,
  );

  /**
   * Property rows
   *
   * @description
   * The links in words.
   *
   * @type {Signal<readonly GitLinkRow[]>}
   * @readonly
   */
  protected readonly rows: Signal<readonly GitLinkRow[]> = computed((): readonly GitLinkRow[] => {
    const now: Date = new Date();
    const key: string = this.taskKey();
    return this.links().map((link: TaskGitLink): GitLinkRow => this.rowOf(link, key, now));
  });

  /**
   * Property locale
   *
   * @description
   * The active locale, for dates.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);
  // #endregion

  // #region Methods
  /**
   * Method rowOf
   *
   * @description
   * One link in words. A request without a recorded title shows its source branch, else its
   * number (then not repeated after it); a merged request shows no review request, as in the
   * mockup.
   *
   * @param {TaskGitLink} link - The link.
   * @param {string} key - Key of the open task, for where it was detected.
   * @param {Date} now - The current instant.
   * @returns {GitLinkRow} The row.
   */
  private rowOf(link: TaskGitLink, key: string, now: Date): GitLinkRow {
    const request: boolean = link.kind === 'pull-request';
    const look: GitStateLook = STATE_LOOKS[link.state];
    const sign: string = link.provider === 'gitlab' ? '!' : '#';
    const number: string | null =
      request && link.number !== null ? `${sign}${link.number.toString()}` : null;
    const diff: boolean = request && (link.additions ?? 0) + (link.deletions ?? 0) > 0;
    const author: string | null = link.author
      ? link.author.name
        ? firstName(link.author.name)
        : link.author.login
      : null;
    const title: string = (request ? (link.title ?? link.branch ?? number) : link.branch) ?? '';
    return {
      id: link.id,
      icon: look.icon,
      tone: look.tone,
      title,
      titleClass:
        !request || (link.title === null && link.branch !== null)
          ? 'font-mono text-[13px] font-medium'
          : 'font-medium',
      number: title === number ? null : number,
      url: link.url,
      state: this.stateLabel(link.state),
      checks: link.checks ? this.checksOf(link.checks, link.checksCompletedAt, now) : null,
      review: request && link.reviewRequested && link.state !== 'merged',
      logo: link.provider === 'gitlab' ? 'svglGitlab' : 'svglGithubLight',
      repository: link.repository?.fullName ?? null,
      additions: diff ? `+${(link.additions ?? 0).toString()}` : null,
      deletions: diff ? `−${(link.deletions ?? 0).toString()}` : null,
      initials: link.author ? initialsOf(link.author.name ?? link.author.login) : null,
      author,
      when: relativeInstant(link.createdAt, now, this.locale),
      source: link.linkSource ? this.sourceLabel(link.linkSource, key) : null,
    };
  }

  /**
   * Method stateLabel
   *
   * @description
   * The state chip's word (`GIT_STATE` of `App.dc.html`).
   *
   * @param {TaskGitLinkState} state - The state.
   * @returns {string} The word.
   */
  private stateLabel(state: TaskGitLinkState): string {
    switch (state) {
      case 'branch':
        return $localize`:@@task.development.state-branch:Branch`;
      case 'draft':
        return $localize`:@@task.development.state-draft:Draft`;
      case 'merged':
        return $localize`:@@task.development.state-merged:Merged`;
      case 'closed':
        return $localize`:@@task.development.state-closed:Closed`;
      default:
        return $localize`:@@task.development.state-open:Open`;
    }
  }

  /**
   * Method checksOf
   *
   * @description
   * The checks in words (`GIT_CI` of `App.dc.html`): passed shows the count over the total when
   * the provider sent it; failed shows the failed count over the total only when some failed,
   * since suites may still run then and the passing ones are not known; running shows `Running`.
   * The tooltip and the screen reader text add when the latest suite or pipeline completed.
   *
   * @param {TaskGitChecks} checks - The checks.
   * @param {string | null} completedAt - When the latest one completed, or null.
   * @param {Date} now - The current instant.
   * @returns {GitChecksRow} The checks row.
   */
  private checksOf(checks: TaskGitChecks, completedAt: string | null, now: Date): GitChecksRow {
    const total: number | null = checks.total;
    let row: Omit<GitChecksRow, 'title'>;
    if (checks.state === 'running') {
      row = {
        icon: 'phosphorCircleNotchBold',
        tone: 'text-balise animate-spin motion-reduce:animate-none',
        label: $localize`:@@task.development.checks-running:Checks running`,
        short: $localize`:@@task.development.checks-running-short:Running`,
      };
    } else if (checks.state === 'failed') {
      const failed: number | null = checks.failed;
      const counted: boolean = total !== null && failed !== null && failed > 0;
      row = {
        icon: 'phosphorXCircleFill',
        tone: 'text-grenat',
        label:
          failed === null || failed === 0
            ? $localize`:@@task.development.checks-failed-some:Checks failed`
            : failed === 1
              ? $localize`:@@task.development.checks-failed-one:1 check failed`
              : $localize`:@@task.development.checks-failed:${failed}:count: checks failed`,
        short: counted
          ? $localize`:@@task.development.checks-failed-short:${failed}:failed:/${total}:total: failed`
          : null,
      };
    } else {
      row = {
        icon: 'phosphorCheckCircleFill',
        tone: 'text-jade',
        label: $localize`:@@task.development.checks-passed:Checks passed`,
        short:
          total !== null
            ? `${(total - (checks.failed ?? 0)).toString()}/${total.toString()}`
            : null,
      };
    }
    const when: string | null =
      completedAt && checks.state !== 'running'
        ? relativeInstant(completedAt, now, this.locale)
        : null;
    return { ...row, title: when ? `${row.label} · ${when}` : row.label };
  }

  /**
   * Method sourceLabel
   *
   * @description
   * Where the key was detected (the `source` of `gitRows` in `App.dc.html`).
   *
   * @param {TaskGitLinkSource} source - The place.
   * @param {string} key - Key of the open task.
   * @returns {string} The words.
   */
  private sourceLabel(source: TaskGitLinkSource, key: string): string {
    switch (source) {
      case 'title':
        return $localize`:@@task.development.detected-title:detected: ${key}:key: in the title`;
      case 'description':
        return $localize`:@@task.development.detected-description:detected: ${key}:key: in the description`;
      case 'commit':
        return $localize`:@@task.development.detected-commit:detected: ${key}:key: in a commit`;
      default:
        return $localize`:@@task.development.detected-branch:detected: ${key}:key: in the branch`;
    }
  }
  // #endregion
}
