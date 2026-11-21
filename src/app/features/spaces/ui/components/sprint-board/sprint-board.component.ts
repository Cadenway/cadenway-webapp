import {
  CdkDrag,
  CdkDragHandle,
  CdkDropList,
  CdkDropListGroup,
  type CdkDragDrop,
} from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import { Component, input, output, type InputSignal, type OutputEmitterRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwEmpty,
  CwEmptyContent,
  CwEmptyHeader,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwPriorityIcon } from '@cadenway/ui/components/priority-icon';
import { CwSelect, CwSelectOption } from '@cadenway/ui/components/select';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { CwToaster } from '@cadenway/ui/components/toast';

import {
  allowsBoardStatus,
  isBoardMoveStatus,
} from '../../../models/sprint-board/sprint-board.model';
import type {
  BoardCard,
  BoardColumn,
  BoardPageChoice,
  BoardPresentation,
  BoardStatusChoice,
} from '../../../models/sprint-board/sprint-board.model';

/**
 * Component SprintBoard
 *
 * @description
 * Presents status groups and emits card moves and pagination to the owning list page.
 */
@Component({
  selector: 'cw-sprint-board',
  templateUrl: './sprint-board.component.html',
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    CdkDropListGroup,
    CwButton,
    CwEmpty,
    CwEmptyContent,
    CwEmptyHeader,
    CwEmptyTitle,
    CwPriorityIcon,
    CwSelect,
    CwSelectOption,
    CwSkeleton,
    CwStatusIcon,
    CwToaster,
    DatePipe,
    RouterLink,
  ],
})
export class SprintBoard {
  // #region Properties
  /**
   * Property view
   *
   * @description
   * Visible columns and current request state and write permissions.
   *
   * @type {InputSignal<BoardPresentation>}
   * @readonly
   */
  public readonly view: InputSignal<BoardPresentation> = input.required<BoardPresentation>();

  /**
   * Property statusChanged
   *
   * @description
   * Carries a selected status from the card or the keyboard control.
   *
   * @type {OutputEmitterRef<BoardStatusChoice>}
   * @readonly
   */
  public readonly statusChanged: OutputEmitterRef<BoardStatusChoice> = output<BoardStatusChoice>();

  /**
   * Property pageRequested
   *
   * @description
   * Carries the column and its requested continuation.
   *
   * @type {OutputEmitterRef<BoardPageChoice>}
   * @readonly
   */
  public readonly pageRequested: OutputEmitterRef<BoardPageChoice> = output<BoardPageChoice>();

  /**
   * Property reloadRequested
   *
   * @description
   * Lets the owning page repeat a failed query.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly reloadRequested: OutputEmitterRef<void> = output();

  /**
   * Property canMove
   *
   * @description
   * Enables a drop only for the reversible statuses offered by the keyboard control.
   *
   * @type {(drag: CdkDrag<BoardCard>, drop: CdkDropList<BoardColumn>) => boolean}
   * @readonly
   */
  protected readonly canMove: (
    drag: CdkDrag<BoardCard>,
    drop: CdkDropList<BoardColumn>,
  ) => boolean = (drag, drop) =>
    this.view().mayEdit && allowsBoardStatus(drag.data, drop.data.status);

  /**
   * Property canOfferMovement
   *
   * @description
   * Leaves transitions out of cancelled and completed statuses to their detail workflows.
   *
   * @type {typeof isBoardMoveStatus}
   * @readonly
   */
  protected readonly canOfferMovement: typeof isBoardMoveStatus = isBoardMoveStatus;

  /**
   * Property allowsStatus
   *
   * @description
   * Applies the same ordinary status restriction to keyboard actions.
   *
   * @type {typeof allowsBoardStatus}
   * @readonly
   */
  protected readonly allowsStatus: typeof allowsBoardStatus = allowsBoardStatus;
  // #endregion

  // #region Methods
  /**
   * Method dropCard
   *
   * @description
   * Hands a cross-column drop to the same action used by the status selector.
   *
   * @param {CdkDragDrop<BoardColumn, BoardColumn, BoardCard>} event - The completed CDK drop.
   */
  protected dropCard(event: CdkDragDrop<BoardColumn, BoardColumn, BoardCard>): void {
    if (event.isPointerOverContainer && event.previousContainer !== event.container) {
      this.statusChanged.emit({ key: event.item.data.key, status: event.container.data.status });
    }
  }
  // #endregion
}
