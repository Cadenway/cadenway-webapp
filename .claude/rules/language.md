# Language

Everything written in this repository is in **English**: source code, identifiers, URL paths, comments
and docblocks, documentation, agent prompts, rules, skills, hook messages, test titles, commit messages,
branch names, pull request titles and descriptions.

**User-facing copy is localized.** Source strings are English, written with `$localize` or an `i18n`
attribute and a stable `@@feature.area.key` id. The mockup's French wording goes, word for word, into the
`fr` translation (`src/locale/messages.fr.xlf`): that is the copy users see. Text quoted from the mockup
(screen names such as `App.dc.html`, labels) stays as it is, inside code formatting.

Keep UI strings out of logic. No emojis. The conversation with the user follows the user's language.
