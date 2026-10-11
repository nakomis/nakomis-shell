import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { RemoteDefinition, ShellConfig } from '../../contract/shell-contract';
import { App } from './App';
import { signOutUrl } from './auth/useShellContext';

const auth = {
  isLoading: false,
  isAuthenticated: true,
  error: undefined as Error | undefined,
  activeNavigator: undefined,
  user: {
    profile: { sub: 's1', 'cognito:username': 'martin', email: 'm@example.com' },
    access_token: 'at',
    id_token: 'it',
    expires_in: 3600,
  } as unknown,
  signinRedirect: vi.fn(async () => {}),
  signinSilent: vi.fn(),
  removeUser: vi.fn(async () => {}),
};
vi.mock('react-oidc-context', () => ({ useAuth: () => auth }));
vi.mock('@module-federation/runtime', () => ({
  loadRemote: vi.fn(async () => ({ default: () => <div>fleet remote</div> })),
  registerRemotes: vi.fn(),
}));

const config: ShellConfig = {
  env: 'sandbox',
  region: 'eu-west-2',
  userPoolId: 'pool',
  clientId: 'client',
  loginDomain: 'login.sandbox.nakomis.com',
};
const remotes: RemoteDefinition[] = [
  { name: 'fleet', title: 'Fleet', icon: 'fleet', path: '/fleet', entry: '/remotes/fleet/remoteEntry.js' },
  {
    name: 'status',
    title: 'Status',
    icon: 'status',
    path: '/status',
    entry: '',
    href: 'https://status.nakom.is',
  },
];

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App config={config} remotes={remotes} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  auth.isAuthenticated = true;
  auth.error = undefined;
  auth.user = {
    profile: { sub: 's1', 'cognito:username': 'martin' },
    access_token: 'at',
    id_token: 'it',
    expires_in: 3600,
  };
  auth.signinRedirect.mockClear();
});

test('home lists every app, including external links', () => {
  renderAt('/');
  expect(screen.getByRole('heading', { name: 'Fleet' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Status' }).closest('a')).toHaveAttribute(
    'href',
    'https://status.nakom.is',
  );
  expect(screen.getByText('martin')).toBeInTheDocument();
  expect(screen.getByText('sandbox')).toBeInTheDocument();
});

test('mounts the remote under its path', async () => {
  renderAt('/fleet/devices/abc');
  expect(await screen.findByText('fleet remote')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Fleet' })).toHaveClass('Mui-selected');
});

test('unknown paths get a not-found message', () => {
  renderAt('/nope');
  expect(screen.getByText(/Nothing here: \/nope/)).toBeInTheDocument();
});

test('redirects to sign in, remembering where the user was going', () => {
  auth.isAuthenticated = false;
  auth.user = undefined;
  renderAt('/fleet/x?y=1');
  expect(auth.signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/fleet/x?y=1' } });
});

test('shows sign-in errors with a way to retry', () => {
  auth.isAuthenticated = false;
  auth.user = undefined;
  auth.error = new Error('bad state');
  renderAt('/');
  expect(screen.getByText(/Sign-in failed: bad state/)).toBeInTheDocument();
});

test('sign-out URL goes through the Cognito logout endpoint', () => {
  expect(signOutUrl(config, 'https://app.sandbox.nakomis.com')).toBe(
    'https://login.sandbox.nakomis.com/logout?client_id=client&logout_uri=https%3A%2F%2Fapp.sandbox.nakomis.com%2F',
  );
});
