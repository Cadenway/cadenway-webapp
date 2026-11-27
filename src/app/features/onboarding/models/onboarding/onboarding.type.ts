/**
 * Type OnboardingStep
 *
 * @description
 * Screen of the assistant: `space` (`Space`), `preset` (`Template`), `team` (`Team`) and `import`
 * (`Import`), in the mockup's order. The import screen starts nothing (import is deferred).
 *
 * @type {'space' | 'preset' | 'team' | 'import'}
 */
export type OnboardingStep = 'space' | 'preset' | 'team' | 'import';

/**
 * Type OnboardingPreset
 *
 * @description
 * Template of the first space, which fixes the lists and example tasks the gateway creates:
 * `dev` (software development), `mkt` (marketing), `agency` (agency and clients) or `blank`
 * (one empty list).
 *
 * @type {'dev' | 'mkt' | 'agency' | 'blank'}
 */
export type OnboardingPreset = 'dev' | 'mkt' | 'agency' | 'blank';

/**
 * Type OnboardingWizardStatus
 *
 * @description
 * Where the assistant stands: `in-progress` accepts draft changes and a finish; `finished` has
 * provisioned the first space; `dismissed` was closed with `Set up later`. Both closed statuses are
 * final.
 *
 * @type {'in-progress' | 'finished' | 'dismissed'}
 */
export type OnboardingWizardStatus = 'in-progress' | 'finished' | 'dismissed';

/**
 * Type OnboardingChecklistPresentation
 *
 * @description
 * How the getting-started checklist shows: `expanded`, `collapsed` to its header, or `dismissed`
 * for good.
 *
 * @type {'expanded' | 'collapsed' | 'dismissed'}
 */
export type OnboardingChecklistPresentation = 'expanded' | 'collapsed' | 'dismissed';
