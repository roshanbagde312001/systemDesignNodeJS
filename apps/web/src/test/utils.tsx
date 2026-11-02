import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes, Providers } from '../App';

/** Renders a component with theme, preferences and a router. */
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

