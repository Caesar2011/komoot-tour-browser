import 'leaflet/dist/leaflet.css';
import '../global.css';

import { AppProviders } from './AppProviders.tsx';
import { AppShell } from './AppShell.tsx';

export function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}
