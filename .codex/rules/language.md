# Language

Everything written in this repository is in **English**: source code, identifiers, URL paths, comments
and docblocks, documentation, agent prompts, rules, skills, hook messages, test titles, commit messages,
branch names, pull request titles and descriptions.

**No French text anywhere in the sources**: code, comments, specs, fixtures and templates. The UI copy is
English, written with `$localize` or an `i18n` attribute and a stable `@@feature.area.key` id. English is
the default locale. The mockup's French wording, word for word, lives only in the French translation
catalog (`src/locale/messages.fr.json`), compiled into the French build served below `/fr/` (English
below `/en/`). Specs assert the English copy. A mockup screen name (`App.dc.html`) stays as it is, inside code formatting.

Keep UI strings out of logic. No emojis. The conversation with the user follows the user's language.
