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

/**
 * Constant PASSIVE_REQUEST
 *
 * @description
 * Fences background requests locally while the pinned context is stale.
 *
 * @type {HttpContextToken<boolean>}
 */
export const PASSIVE_REQUEST: HttpContextToken<boolean> = new HttpContextToken<boolean>(
  () => false,
);
