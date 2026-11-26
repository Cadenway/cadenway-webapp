/**
 * Function newDraftKey
 *
 * @description
 * A private applicant key, as the contract defines it (`IntakeDraftKey`): 32 cryptographically
 * random bytes encoded as unpadded base64url, 43 characters long.
 *
 * @returns {string} A new draft key.
 */
export function newDraftKey(): string {
  const bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(32));
  let binary: string = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}
