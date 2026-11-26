import type { Provider } from '@angular/core';
import { provideCwAttachmentLabels } from '@cadenway/ui/components/attachment';
import { provideCwAvatarLabels } from '@cadenway/ui/components/avatar';
import {
  CW_BLOCK_TYPES,
  CW_INLINE_MARKS,
  type CwBlockKind,
  type CwBlockType,
  type CwInlineMark,
  type CwInlineMarkButton,
  provideCwBlockEditorLabels,
} from '@cadenway/ui/components/block-editor';
import {
  CW_COMPOSER_COMMANDS,
  type CwComposerCommand,
  provideCwCommentComposerLabels,
} from '@cadenway/ui/components/comment-composer';
import { provideCwDropzoneLabels } from '@cadenway/ui/components/dropzone';
import { provideCwMarkdownLabels } from '@cadenway/ui/components/markdown';

/**
 * Constant COUNT_TOKEN
 *
 * @description
 * The token the block editor replaces with a result count; passed as a placeholder so the
 * catalogs do not read its braces as an ICU expression.
 *
 * @type {string}
 */
const COUNT_TOKEN: string = '{count}';

/**
 * Constant TEXT_TOKEN
 *
 * @description
 * The token the block editor replaces with a task item's text.
 *
 * @type {string}
 */
const TEXT_TOKEN: string = '{text}';

/**
 * Function blockLabels
 *
 * @description
 * The words of the block types (`App.dc.html`, `BLOCK_TYPES`).
 *
 * @returns {Readonly<Record<CwBlockKind, string>>} The label of each type.
 */
function blockLabels(): Readonly<Record<CwBlockKind, string>> {
  return {
    p: $localize`:@@task.editor.block-text:Text`,
    h1: $localize`:@@task.editor.block-h1:Heading 1`,
    h2: $localize`:@@task.editor.block-h2:Heading 2`,
    h3: $localize`:@@task.editor.block-h3:Heading 3`,
    li: $localize`:@@task.editor.block-bullets:Bulleted list`,
    ol: $localize`:@@task.editor.block-numbers:Numbered list`,
    todo: $localize`:@@task.editor.block-todo:Task list`,
    quote: $localize`:@@task.editor.block-quote:Quote`,
    code: $localize`:@@task.editor.block-code:Code block`,
    hr: $localize`:@@task.editor.block-separator:Separator`,
  };
}

/**
 * Function markLabels
 *
 * @description
 * The words of the inline marks (`App.dc.html`, `MARK_BTNS`).
 *
 * @returns {Readonly<Record<CwInlineMark, string>>} The label of each mark.
 */
function markLabels(): Readonly<Record<CwInlineMark, string>> {
  return {
    bold: $localize`:@@task.editor.bold:Bold`,
    italic: $localize`:@@task.editor.italic:Italic`,
    underline: $localize`:@@task.editor.underline:Underline`,
    strike: $localize`:@@task.editor.strike:Strikethrough`,
    code: $localize`:@@task.editor.code:Code`,
  };
}

/**
 * Constant TASK_SECTIONS_BRICK_LABELS
 *
 * @description
 * English source texts of the bricks the detail tabs render (block editor, comment composer,
 * Markdown, attachment, drop zone, avatar), replacing their French defaults; the French catalog
 * gives the mockup's words where it has them, the bricks' own otherwise.
 *
 * @type {readonly Provider[]}
 */
export const TASK_SECTIONS_BRICK_LABELS: readonly Provider[] = [
  provideCwBlockEditorLabels(() => {
    const blocks: Readonly<Record<CwBlockKind, string>> = blockLabels();
    const marks: Readonly<Record<CwInlineMark, string>> = markLabels();
    return {
      toolbar: $localize`:@@task.editor.toolbar:Formatting`,
      blockType: $localize`:@@task.editor.block-type:Block type`,
      blockMenu: $localize`:@@task.editor.block-menu:Blocks`,
      mentionMenu: $localize`:@@task.editor.mention-menu:People`,
      noResults: $localize`:@@task.editor.no-results:No results`,
      oneResult: $localize`:@@task.editor.one-result:1 result`,
      manyResults: $localize`:@@task.editor.many-results:${COUNT_TOKEN}:count: results`,
      choose: $localize`:@@task.editor.choose:choose`,
      insert: $localize`:@@task.editor.insert:insert`,
      up: $localize`:@@task.editor.up:Up`,
      down: $localize`:@@task.editor.down:Down`,
      enter: $localize`:@@task.editor.enter:Enter`,
      link: $localize`:@@task.editor.link:Link`,
      linkPanel: $localize`:@@task.editor.link-panel:Insert a link`,
      linkUrl: $localize`:@@task.editor.link-url:Link address`,
      linkPlaceholder: 'https://…',
      linkApply: $localize`:@@task.editor.link-apply:Insert`,
      emptyBlock: $localize`:@@task.editor.empty-block:Type “/” to insert a block`,
      check: $localize`:@@task.editor.check:Check “${TEXT_TOKEN}:text:”`,
      uncheck: $localize`:@@task.editor.uncheck:Uncheck “${TEXT_TOKEN}:text:”`,
      task: $localize`:@@task.editor.task:task`,
      placeholder: $localize`:@@task.editor.placeholder:Add a description, or type “/” to insert a block`,
      ariaLabel: $localize`:@@task.editor.aria-label:Content of the document`,
      blockTypes: CW_BLOCK_TYPES.map((type: CwBlockType): CwBlockType => ({
        ...type,
        label: blocks[type.kind],
      })),
      inlineMarks: CW_INLINE_MARKS.map((mark: CwInlineMarkButton): CwInlineMarkButton => ({
        ...mark,
        label: marks[mark.mark],
        shortcut: mark.shortcut.map((key: string): string =>
          key === 'Maj' ? $localize`:@@task.editor.shift:Shift` : key,
        ),
      })),
    };
  }),
  provideCwCommentComposerLabels(() => {
    const blocks: Readonly<Record<CwBlockKind, string>> = blockLabels();
    return {
      editor: $localize`:@@task.composer.label:Write a comment`,
      toolbar: $localize`:@@task.editor.toolbar:Formatting`,
      formatting: $localize`:@@task.editor.toolbar:Formatting`,
      bold: $localize`:@@task.editor.bold:Bold`,
      italic: $localize`:@@task.editor.italic:Italic`,
      link: $localize`:@@task.editor.link:Link`,
      bulletList: $localize`:@@task.editor.block-bullets:Bulleted list`,
      code: $localize`:@@task.editor.code:Code`,
      mention: $localize`:@@task.composer.mention:Mention`,
      attach: $localize`:@@task.composer.attach:Attach a file`,
      send: $localize`:@@task.composer.send:Send the comment`,
      save: $localize`:@@task.composer.save:Save`,
      cancel: $localize`:@@task.composer.cancel:Cancel`,
      retry: $localize`:@@task.retry:Retry`,
      sendKeys: ['Ctrl', $localize`:@@task.editor.enter:Enter`],
      placeholder: $localize`:@@task.composer.placeholder:Write a comment… (Ctrl Enter to send)`,
      disabledText: $localize`:@@task.composer.disabled:Comments disabled`,
      commands: CW_COMPOSER_COMMANDS.map((command: CwComposerCommand): CwComposerCommand => ({
        ...command,
        label:
          command.kind === 'h2'
            ? $localize`:@@task.composer.heading:Heading`
            : blocks[command.kind],
      })),
    };
  }),
  provideCwMarkdownLabels(() => ({ mention: $localize`:@@task.comments.mention:mention` })),
  provideCwAttachmentLabels(() => ({
    image: $localize`:@@task.attachments.kind-image:Image`,
    file: $localize`:@@task.attachments.kind-file:File`,
    download: $localize`:@@task.attachments.download:Download`,
    open: $localize`:@@task.attachments.open:Open`,
    retry: $localize`:@@task.attachments.retry-of:Retry sending`,
    cancel: $localize`:@@task.attachments.cancel-of:Cancel sending`,
    progress: $localize`:@@task.attachments.progress-of:Sending`,
    processing: $localize`:@@task.attachments.processing:Generating the preview…`,
    processingShort: $localize`:@@task.attachments.processing-short:Preview…`,
    uploading: $localize`:@@task.attachments.uploading:Sending…`,
    failed: $localize`:@@task.attachments.failed:Failed`,
    sending: $localize`:@@task.attachments.sending:Sending in progress`,
    working: $localize`:@@task.attachments.working:Processing`,
    done: $localize`:@@task.attachments.done:attached`,
    remove: $localize`:@@task.attachments.remove:Remove`,
  })),
  provideCwDropzoneLabels(() => ({
    title: $localize`:@@task.attachments.drop-title:Drop files here`,
    browse: $localize`:@@task.attachments.browse:click to browse`,
    max: $localize`:@@task.attachments.max:max`,
    or: $localize`:@@task.attachments.or:or`,
    browseAria: $localize`:@@task.attachments.browse-aria:the files`,
    drop: $localize`:@@task.attachments.drop:Release to attach the files`,
    reject: $localize`:@@task.attachments.reject:Type not accepted`,
    limit: $localize`:@@task.attachments.limit:Limit reached`,
    file: $localize`:@@task.attachments.file:file`,
    files: $localize`:@@task.attachments.files:files`,
  })),
  provideCwAvatarLabels(() => ({
    unknown: $localize`:@@task.sections.avatar-unknown:Unknown user`,
    online: $localize`:@@task.sections.avatar-online:online`,
    away: $localize`:@@task.sections.avatar-away:away`,
    dnd: $localize`:@@task.sections.avatar-dnd:do not disturb`,
    invisible: $localize`:@@task.sections.avatar-invisible:invisible`,
    disabled: $localize`:@@task.sections.avatar-disabled:disabled`,
    group: $localize`:@@task.sections.avatar-group:Assignees`,
    othersPrefix: $localize`:@@task.sections.avatar-others:and`,
    add: $localize`:@@task.sections.avatar-add:Assign`,
  })),
];
