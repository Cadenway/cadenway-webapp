import type { Provider } from '@angular/core';
import {
  CW_BLOCK_TYPES,
  CW_INLINE_MARKS,
  type CwBlockKind,
  type CwBlockType,
  type CwInlineMark,
  type CwInlineMarkButton,
  provideCwBlockEditorLabels,
} from '@cadenway/ui/components/block-editor';

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
 * The words of the block types (`App.dc.html` lines 4089-4100, `BLOCK_TYPES`).
 *
 * @returns {Readonly<Record<CwBlockKind, string>>} The label of each type.
 */
function blockLabels(): Readonly<Record<CwBlockKind, string>> {
  return {
    p: $localize`:@@docs.editor.block-text:Text`,
    h1: $localize`:@@docs.editor.block-h1:Heading 1`,
    h2: $localize`:@@docs.editor.block-h2:Heading 2`,
    h3: $localize`:@@docs.editor.block-h3:Heading 3`,
    li: $localize`:@@docs.editor.block-bullets:Bulleted list`,
    ol: $localize`:@@docs.editor.block-numbers:Numbered list`,
    todo: $localize`:@@docs.editor.block-todo:Task list`,
    quote: $localize`:@@docs.editor.block-quote:Quote`,
    code: $localize`:@@docs.editor.block-code:Code block`,
    hr: $localize`:@@docs.editor.block-separator:Separator`,
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
    bold: $localize`:@@docs.editor.bold:Bold`,
    italic: $localize`:@@docs.editor.italic:Italic`,
    underline: $localize`:@@docs.editor.underline:Underline`,
    strike: $localize`:@@docs.editor.strike:Strikethrough`,
    code: $localize`:@@docs.editor.code:Code`,
  };
}

/**
 * Constant DOCS_BLOCK_EDITOR_LABELS
 *
 * @description
 * English source texts of the document editor (`cw-block-editor`), replacing its French
 * defaults: the toolbar, the block types, the link panel, the checkboxes and the placeholders of
 * `App.dc.html` (lines 1957, 4089-4100 and 6031). The French catalog gives the mockup's words
 * where it has them, the brick's own otherwise.
 *
 * @type {Provider}
 */
export const DOCS_BLOCK_EDITOR_LABELS: Provider = provideCwBlockEditorLabels(() => {
  const blocks: Readonly<Record<CwBlockKind, string>> = blockLabels();
  const marks: Readonly<Record<CwInlineMark, string>> = markLabels();
  return {
    toolbar: $localize`:@@docs.editor.toolbar:Formatting`,
    blockType: $localize`:@@docs.editor.block-type:Block type`,
    blockMenu: $localize`:@@docs.editor.block-menu:Blocks`,
    mentionMenu: $localize`:@@docs.editor.mention-menu:People`,
    noResults: $localize`:@@docs.editor.no-results:No results`,
    oneResult: $localize`:@@docs.editor.one-result:1 result`,
    manyResults: $localize`:@@docs.editor.many-results:${COUNT_TOKEN}:count: results`,
    choose: $localize`:@@docs.editor.choose:choose`,
    insert: $localize`:@@docs.editor.insert:insert`,
    up: $localize`:@@docs.editor.up:Up`,
    down: $localize`:@@docs.editor.down:Down`,
    enter: $localize`:@@docs.editor.enter:Enter`,
    link: $localize`:@@docs.editor.link:Link`,
    linkPanel: $localize`:@@docs.editor.link-panel:Insert a link`,
    linkUrl: $localize`:@@docs.editor.link-url:Link address`,
    linkPlaceholder: 'https://…',
    linkApply: $localize`:@@docs.editor.link-apply:Insert`,
    emptyBlock: $localize`:@@docs.editor.empty-block:Type “/” to insert a block`,
    check: $localize`:@@docs.editor.check:Check “${TEXT_TOKEN}:text:”`,
    uncheck: $localize`:@@docs.editor.uncheck:Uncheck “${TEXT_TOKEN}:text:”`,
    task: $localize`:@@docs.editor.task:task`,
    placeholder: $localize`:@@docs.editor.placeholder:Write, or type “/” to insert a block`,
    ariaLabel: $localize`:@@docs.editor.aria-label:Document content`,
    blockTypes: CW_BLOCK_TYPES.map((type: CwBlockType): CwBlockType => ({
      ...type,
      label: blocks[type.kind],
    })),
    inlineMarks: CW_INLINE_MARKS.map((mark: CwInlineMarkButton): CwInlineMarkButton => ({
      ...mark,
      label: marks[mark.mark],
      shortcut: mark.shortcut.map((key: string): string =>
        key === 'Maj' ? $localize`:@@docs.editor.shift:Shift` : key,
      ),
    })),
  };
});
