import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import type { RememberedAccount } from '../../models/remembered-account/remembered-account.interface';
import { RememberedAccountsService } from './remembered-accounts.service';

/**
 * Constant camille
 *
 * @description
 * Camille's Atelier Nord account.
 *
 * @type {RememberedAccount}
 */
const camille: RememberedAccount = {
  name: 'Camille Martin',
  email: 'camille.martin@ateliernord.fr',
};

/**
 * Constant lumen
 *
 * @description
 * Camille's Lumen account.
 *
 * @type {RememberedAccount}
 */
const lumen: RememberedAccount = { name: 'Camille Martin (Lumen)', email: 'c.martin@lumen.coop' };

describe('RememberedAccountsService', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('remembers accounts most recent first without duplicating an address', () => {
    const service: RememberedAccountsService = TestBed.inject(RememberedAccountsService);

    service.remember(camille);
    service.remember(lumen);
    service.remember({ ...camille, email: 'Camille.Martin@AtelierNord.fr' });

    expect(service.accounts().map((account: RememberedAccount) => account.name)).toEqual([
      'Camille Martin',
      'Camille Martin (Lumen)',
    ]);
    expect(JSON.parse(localStorage.getItem('cadenway-remembered-accounts') ?? '[]')).toHaveLength(
      2,
    );
  });

  it('forgets an account and puts it back at its place on undo', () => {
    localStorage.setItem('cadenway-remembered-accounts', JSON.stringify([camille, lumen]));
    const service: RememberedAccountsService = TestBed.inject(RememberedAccountsService);

    const forgotten: ReturnType<RememberedAccountsService['forget']> = service.forget(
      camille.email,
    );
    expect(service.accounts()).toEqual([lumen]);
    expect(service.forget('nobody@ateliernord.fr')).toBeNull();
    if (forgotten === null) throw new Error('Expected the forgotten account.');
    service.restore(forgotten);

    expect(service.accounts()).toEqual([camille, lumen]);
  });

  it('ignores a malformed stored list', () => {
    localStorage.setItem('cadenway-remembered-accounts', '{"not":"a list"');

    expect(TestBed.inject(RememberedAccountsService).accounts()).toEqual([]);
  });
});
