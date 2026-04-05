import { useContext } from 'preact/hooks';

import { AppContext } from './AppContext.ts';

export function useAppContext() {
  return useContext(AppContext);
}
