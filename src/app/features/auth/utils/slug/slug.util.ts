/**
 * Function slugFromName
 *
 * @description
 * Derives the organization address preview the way the gateway derives it from the name
 * (`POST /v1/organizations`): accents removed, lowercase, every run of other characters turned
 * into `-`, dashes trimmed at both ends, cut to 63 characters. The gateway stays the authority:
 * it refuses an address shorter than 2 characters, a taken one and a reserved one.
 *
 * @param {string} name - Organization name as typed.
 * @returns {string} The derived address, possibly empty.
 */
export function slugFromName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
}
