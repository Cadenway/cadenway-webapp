import { bootstrapApplication } from '@angular/platform-browser';

// The shell and its providers load as their own chunk, which keeps the entry chunk within the
// initial budget. The locale needs no preparation: each locale is a separate, translated build.
Promise.all([import('@app/app.component'), import('@app/app.config')])
  .then(
    async ([shell, config]: [
      typeof import('@app/app.component'),
      typeof import('@app/app.config'),
    ]): Promise<void> => {
      await bootstrapApplication(shell.App, config.appConfig);
    },
  )
  .catch((error: unknown) => {
    console.error(error);
  });
