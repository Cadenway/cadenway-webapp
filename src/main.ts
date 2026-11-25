import { bootstrapApplication } from '@angular/platform-browser';

import { loadLocale } from '@core/locale';

// `$localize` translates a message when its module evaluates, so the application modules load
// only once the locale of this load is installed.
loadLocale(window)
  .then(async (): Promise<void> => {
    const [shell, config]: [typeof import('@app/app.component'), typeof import('@app/app.config')] =
      await Promise.all([import('@app/app.component'), import('@app/app.config')]);
    await bootstrapApplication(shell.App, config.appConfig);
  })
  .catch((error: unknown) => {
    console.error(error);
  });
