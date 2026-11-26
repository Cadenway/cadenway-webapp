import { ListTasksApi } from '../../data-access/services/list-tasks-api/list-tasks-api.service';
import { ListTasksStore } from '../list-tasks/list-tasks.store';
import { WORKLOAD_VIEW_PROVIDERS } from './workload-view.providers';

describe('WORKLOAD_VIEW_PROVIDERS', () => {
  it('provides the list task data access in the view scope, beside the reader that injects it', () => {
    expect(WORKLOAD_VIEW_PROVIDERS).toContain(ListTasksStore);
    expect(WORKLOAD_VIEW_PROVIDERS).toContain(ListTasksApi);
  });
});
