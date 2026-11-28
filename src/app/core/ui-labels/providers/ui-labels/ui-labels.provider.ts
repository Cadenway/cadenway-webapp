import type { Provider } from '@angular/core';
import { provideCwAlertLabels } from '@cadenway/ui/components/alert';
import { provideCwBadgeLabels } from '@cadenway/ui/components/badge';
import { provideCwBannerLabels } from '@cadenway/ui/components/banner';
import { provideCwKbdLabels } from '@cadenway/ui/components/kbd';
import { provideCwPriorityLabels } from '@cadenway/ui/components/priority-icon';
import { provideCwSheetLabels } from '@cadenway/ui/components/sheet';
import { provideCwSidebarLabels } from '@cadenway/ui/components/sidebar';
import { provideCwSpinnerLabels } from '@cadenway/ui/components/spinner';
import { provideCwSplitButtonLabels } from '@cadenway/ui/components/split-button';

/**
 * Function provideCadenwayUiLabels
 *
 * @description
 * The application's texts for the `@cadenway/ui` bricks that every area renders and that no
 * feature names itself: key names (`cw-shortcut`, `cwKbd` in the command palette footer), the
 * close buttons of alerts, banners and sheets, the sidebar's default names, the spinner's loading
 * name, the split button's menu, and the priority words of icons and badges. The bricks' built-in
 * texts are French; these English sources, with their `@@core.ui-labels.*` ids, replace them, and
 * the French catalog gives them back the mockup's words. A feature or a layout that renders a
 * brick with other words still provides its own labels below, merged over these.
 *
 * @returns {Provider[]} The label providers, for the providers of the top-level routes.
 */
export function provideCadenwayUiLabels(): Provider[] {
  return [
    provideCwKbdLabels(() => ({
      then: $localize`:@@core.ui-labels.kbd.then:then`,
      control: $localize`:@@core.ui-labels.kbd.control:Ctrl`,
      controlSpoken: $localize`:@@core.ui-labels.kbd.control-spoken:Control`,
      commandSpoken: $localize`:@@core.ui-labels.kbd.command-spoken:Command`,
      shift: $localize`:@@core.ui-labels.kbd.shift:Shift`,
      shiftSpoken: $localize`:@@core.ui-labels.kbd.shift-spoken:Shift`,
      optionSpoken: $localize`:@@core.ui-labels.kbd.option-spoken:Option`,
      alt: $localize`:@@core.ui-labels.kbd.alt:Alt`,
      escape: $localize`:@@core.ui-labels.kbd.escape:Esc`,
      enter: $localize`:@@core.ui-labels.kbd.enter:Enter`,
      tab: $localize`:@@core.ui-labels.kbd.tab:Tab`,
      delete: $localize`:@@core.ui-labels.kbd.delete:Delete`,
      backspace: $localize`:@@core.ui-labels.kbd.backspace:Backspace`,
      space: $localize`:@@core.ui-labels.kbd.space:Space`,
      upSpoken: $localize`:@@core.ui-labels.kbd.up-spoken:Up arrow`,
      downSpoken: $localize`:@@core.ui-labels.kbd.down-spoken:Down arrow`,
      leftSpoken: $localize`:@@core.ui-labels.kbd.left-spoken:Left arrow`,
      rightSpoken: $localize`:@@core.ui-labels.kbd.right-spoken:Right arrow`,
    })),
    provideCwAlertLabels(() => ({
      close: $localize`:@@core.ui-labels.alert.close:Close`,
    })),
    provideCwBannerLabels(() => ({
      close: $localize`:@@core.ui-labels.banner.close:Hide the banner`,
    })),
    provideCwSheetLabels(() => ({
      close: $localize`:@@core.ui-labels.sheet.close:Close`,
    })),
    provideCwSidebarLabels(() => ({
      ariaLabel: $localize`:@@core.ui-labels.sidebar.label:Main navigation`,
      closeLabel: $localize`:@@core.ui-labels.sidebar.close:Close the sidebar`,
      collapseLabel: $localize`:@@core.ui-labels.sidebar.collapse:Collapse the sidebar`,
      expandLabel: $localize`:@@core.ui-labels.sidebar.expand:Expand the sidebar`,
    })),
    provideCwSpinnerLabels(() => ({
      loading: $localize`:@@core.ui-labels.spinner.loading:Loading`,
    })),
    provideCwSplitButtonLabels(() => ({
      menu: $localize`:@@core.ui-labels.split-button.menu:More options`,
    })),
    provideCwPriorityLabels(() => ({
      urgente: $localize`:@@core.ui-labels.priority.urgent:Urgent`,
      haute: $localize`:@@core.ui-labels.priority.high:High`,
      moyenne: $localize`:@@core.ui-labels.priority.medium:Medium`,
      basse: $localize`:@@core.ui-labels.priority.low:Low`,
    })),
    provideCwBadgeLabels(() => ({
      urgente: $localize`:@@core.ui-labels.badge.urgent:Urgent priority`,
      haute: $localize`:@@core.ui-labels.badge.high:High priority`,
      moyenne: $localize`:@@core.ui-labels.badge.medium:Medium priority`,
      basse: $localize`:@@core.ui-labels.badge.low:Low priority`,
    })),
  ];
}
