import { HttpContextToken } from '@angular/common/http';

/**
 * Constant SKIP_ORGANIZATION_PIN
 *
 * @description
 * Allows the workspace guard to discover the session's actual organization during recovery.
 *
 * @type {HttpContextToken<boolean>}
 */
export const SKIP_ORGANIZATION_PIN: HttpContextToken<boolean> = new HttpContextToken<boolean>(
  () => false,
);
