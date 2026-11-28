/**
 * Type NavigationRead
 *
 * @description
 * A read of the spaces navigation that starts only once a rendered consumer asks for it
 * (`SpacesNavigationStore.request`): the spaces, the favorites, the overviews of the spaces
 * (which need the spaces) or the trash and archive counts of the sidebar footer.
 *
 * @type {'spaces' | 'favorites' | 'overviews' | 'counts'}
 */
export type NavigationRead = 'spaces' | 'favorites' | 'overviews' | 'counts';
