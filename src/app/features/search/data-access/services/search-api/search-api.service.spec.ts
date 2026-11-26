import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import type { SearchResult } from '../../../models/search-result/search-result.interface';
import { SearchApi } from './search-api.service';

describe('SearchApi', () => {
  it('searches one page of tasks and lists as display models', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http: HttpTestingController = TestBed.inject(HttpTestingController);

    const answer: Promise<readonly SearchResult[]> = firstValueFrom(
      TestBed.inject(SearchApi).search('sso'),
    );
    http
      .expectOne((request) => request.url === '/v1/search' && request.params.get('q') === 'sso')
      .flush({
        items: [
          { kind: 'task', taskKey: 'CAD-482', name: 'Review of the SSO flow', status: 'review' },
        ],
        nextCursor: null,
      });

    await expect(answer).resolves.toEqual([
      { kind: 'task', key: 'CAD-482', name: 'Review of the SSO flow', status: 'review' },
    ]);
    http.verify();
  });
});
