import { Component, input, type InputSignal, output, type OutputEmitterRef } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

/**
 * Component TaskDevelopment
 *
 * @description
 * Placeholder of the `Development` section of `Details` (`App.dc.html` lines 2192-2268): it shows
 * the mockup's empty state, `No branch or pull request`, and the footer hint that citing the key in
 * a branch, a commit or a pull request title links it (`fixes <key>` moves the task to `Done` on
 * merge), the key being a `Copy the identifier` button. It has no `Link a PR` or `Create a branch`
 * action: the read of a task's Git links is still being added to the contracts, and the Git panel
 * (rows, commits, CI and review states, linking, unlinking, branch creation) is built in a later
 * step of the start-up plan, which reads it again on `TaskDetailStore.gitRevision`.
 */
@Component({
  selector: 'cw-task-development',
  imports: [NgIcon],
  host: { class: 'flex flex-col gap-2 px-2' },
  template: `
    <section
      aria-label="Development"
      i18n-aria-label="@@task.development.title"
      class="flex flex-col gap-2"
      data-testid="task-development"
    >
      <div class="flex h-8 items-center gap-2">
        <h3 class="text-base font-semibold" i18n="@@task.development.title">Development</h3>
      </div>
      <div
        class="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5"
      >
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted"
          aria-hidden="true"
        >
          <ng-icon name="phosphorGitPullRequestBold" class="text-muted-foreground" />
        </span>
        <span class="flex min-w-0 flex-col leading-tight">
          <span class="text-sm font-medium" i18n="@@task.development.empty"
            >No branch or pull request</span
          >
          <span class="text-xs text-muted-foreground" i18n="@@task.development.empty-text"
            >Create the branch from here, or link an existing PR.</span
          >
        </span>
      </div>
      <p class="flex items-start gap-1.5 text-xs/5 text-muted-foreground">
        <span class="flex h-5 shrink-0 items-center">
          <ng-icon name="phosphorInfoBold" size="0.875rem" aria-hidden="true" />
        </span>
        <span class="min-w-0" i18n="@@task.development.hint"
          >Mention
          <button
            type="button"
            title="Copy the identifier"
            i18n-title="@@task.detail.copy-key"
            class="rounded bg-muted px-1 font-mono text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            (click)="keyCopied.emit()"
          >
            {{ taskKey() }}
          </button>
          in the name of a branch, a commit or the title of a PR: it links itself.
          <span class="font-mono whitespace-nowrap">fixes {{ taskKey() }}</span> moves it to Done on
          merge.</span
        >
      </p>
    </section>
  `,
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
   * Property keyCopied
   *
   * @description
   * Emits when the key is clicked, to copy it.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly keyCopied: OutputEmitterRef<void> = output();
  // #endregion
}
