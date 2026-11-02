import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes, Providers } from '../App';

/** Renders a component with theme, preferences, auth and a router. */
export function renderWithProviders(ui: ReactElement, route = '/') {
  return render(
    <Providers>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </Providers>,
  );
}

/** Renders the full app at a route. */
export function renderApp(route: string) {
  return renderWithProviders(<AppRoutes />, route);
}

/** Simulates the API being offline so the bundled content is used. */
export function apiOffline() {
  return vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
