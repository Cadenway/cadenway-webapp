import { HttpContext } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { RealtimeService } from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';

import { PASSIVE_REQUEST } from '@core/api';

/**
 * Service WorkspaceRealtime
 *
 * @description
 * Obtains single-use handshake tickets through the generated client.
 */
@Service()
export class WorkspaceRealtime {
  // #region Properties
  /**
   * Property realtime
   *
   * @description
   * Generated gateway ticket operation.
   *
   * @type {RealtimeService}
   * @readonly
   */
  private readonly realtime: RealtimeService = inject(RealtimeService);
  // #endregion

  // #region Methods
  /**
   * Method issueTicket
   *
   * @description
   * Requests a fresh credential for one Socket.IO handshake.
   *
   * @returns {Promise<string>} Opaque single-use ticket.
   */
  public async issueTicket(): Promise<string> {
    return (
      await firstValueFrom(
        this.realtime.issueRealtimeTicket(
          {},
          { context: new HttpContext().set(PASSIVE_REQUEST, true) },
        ),
      )
    ).token;
  }
  // #endregion
}
