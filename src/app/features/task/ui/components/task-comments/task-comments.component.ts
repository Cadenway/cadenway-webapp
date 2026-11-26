import { Component, input, type InputSignal, output, type OutputEmitterRef } from '@angular/core';
import { CwAvatar } from '@cadenway/ui/components/avatar';
import { CwButton } from '@cadenway/ui/components/button';
import { CwContextMenuTriggerFor } from '@cadenway/ui/components/context-menu';
import { CwMarkdown } from '@cadenway/ui/components/markdown';
import {
  CwMenu,
  CwMenuItem,
  CwMenuSeparator,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';
import { NgIcon } from '@ng-icons/core';

import type { TaskComment } from '../../../models/task-detail/task-detail.interface';

/**
 * Interface TaskCommentRow
 *
 * @description
 * A comment as the tab lists it.
 */
export interface TaskCommentRow {
  // #region Properties
  /**
   * Property comment
   *
   * @description
   * The comment.
   *
   * @type {TaskComment}
   * @readonly
   */
  readonly comment: TaskComment;

  /**
   * Property name
   *
   * @description
   * Its author's name (or what names an automation or a service).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property person
   *
   * @description
   * The author's name for the avatar, or null for an author without one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly person: string | null;

  /**
   * Property mine
   *
   * @description
   * Whether the caller wrote it.
   *
   * @type {boolean}
   * @readonly
   */
  readonly mine: boolean;

  /**
   * Property time
   *
   * @description
   * When it was written, in words.
   *
   * @type {string}
   * @readonly
   */
  readonly time: string;
  // #endregion
}

/**
 * Component TaskComments
 *
 * @description
 * The list of the `Comments` tab (`App.dc.html` lines 2305-2324, 7374-7388): each comment, oldest
 * first (`Show more comments` after them while newer pages remain), with its avatar, author and time and
 * its body rendered read-only by `cw-markdown` (the caller's own in the secondary bubble). A right
 * click, Shift F10, the Menu key, or the `More actions` button shown on hover and focus opens the
 * menu `Comment from <name>`: `Copy the text`, `Reply` (when the caller may comment) and, for the
 * caller's own comments, `Delete`. The first page's loading skeleton and inline error with
 * `Retry`, the later pages' own error, and the empty state `No comments`. It only emits.
 */
@Component({
  selector: 'cw-task-comments',
  imports: [
    CwAvatar,
    CwButton,
    CwContextMenuTriggerFor,
    CwMarkdown,
    CwMenu,
    CwMenuItem,
    CwMenuSeparator,
    CwMenuTriggerFor,
    NgIcon,
  ],
  host: { class: 'flex flex-col gap-4' },
  templateUrl: './task-comments.component.html',
})
export class TaskComments {
  // #region Properties
  /**
   * Property rows
   *
   * @description
   * The comments shown.
   *
   * @type {InputSignal<readonly TaskCommentRow[]>}
   * @readonly
   */
  public readonly rows: InputSignal<readonly TaskCommentRow[]> =
    input.required<readonly TaskCommentRow[]>();

  /**
   * Property loading
   *
   * @description
   * Whether the first page is being read with nothing to show.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly loading: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property failed
   *
   * @description
   * Whether the first page is missing (partial detail or failed read).
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly failed: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property hasMore
   *
   * @description
   * Whether newer pages remain to be read.
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
   * Property canComment
   *
   * @description
   * Whether the caller may reply and delete their comments.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly canComment: InputSignal<boolean> = input<boolean>(true);

  /**
   * Property retried
   *
   * @description
   * Emits when `Retry` is pressed after the first page failed.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly retried: OutputEmitterRef<void> = output();

  /**
   * Property moreLoaded
   *
   * @description
   * Emits when `Show more comments` (or its `Retry`) is pressed.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly moreLoaded: OutputEmitterRef<void> = output();

  /**
   * Property copied
   *
   * @description
   * Emits the comment whose text to copy.
   *
   * @type {OutputEmitterRef<TaskCommentRow>}
   * @readonly
   */
  public readonly copied: OutputEmitterRef<TaskCommentRow> = output<TaskCommentRow>();

  /**
   * Property replied
   *
   * @description
   * Emits the comment to answer.
   *
   * @type {OutputEmitterRef<TaskCommentRow>}
   * @readonly
   */
  public readonly replied: OutputEmitterRef<TaskCommentRow> = output<TaskCommentRow>();

  /**
   * Property deleted
   *
   * @description
   * Emits the caller's comment to delete.
   *
   * @type {OutputEmitterRef<TaskComment>}
   * @readonly
   */
  public readonly deleted: OutputEmitterRef<TaskComment> = output<TaskComment>();
  // #endregion

  // #region Methods
  /**
   * Method menuLabel
   *
   * @description
   * Name of a comment's menu.
   *
   * @param {TaskCommentRow} row - The comment.
   * @returns {string} The name.
   */
  protected menuLabel(row: TaskCommentRow): string {
    return $localize`:@@task.comments.menu:Comment from ${row.name}:name:`;
  }
  // #endregion
}
