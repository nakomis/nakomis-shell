import { renderHook } from '@testing-library/react';
import type { ShellConfig } from '../../../contract/shell-contract';
import { isSigningOut, resetSigningOutForTests, useShellContext } from './useShellContext';

const auth = {
  user: undefined as unknown,
  signinSilent: vi.fn(),
  removeUser: vi.fn(async () => {}),
};
vi.mock('react-oidc-context', () => ({ useAuth: () => auth }));

const config: ShellConfig = {
  env: 'sandbox',
  region: 'eu-west-2',
  userPoolId: 'pool',
  clientId: 'client',
  loginDomain: 'login.example',
};
const user = (expires_in: number, token = 'at') => ({
  profile: { sub: 's1', 'cognito:username': 'martin', email: 'm@example.com' },
  access_token: token,
  id_token: `id-${token}`,
  expires_in,
});

beforeEach(() => {
  auth.user = user(3600);
  auth.signinSilent.mockReset();
  auth.removeUser.mockClear();
  resetSigningOutForTests();
});

test('is undefined until signed in', () => {
  auth.user = undefined;
  const { result } = renderHook(() => useShellContext(config));
  expect(result.current).toBeUndefined();
});

test('exposes the user and a fresh token without renewing', async () => {
  const { result } = renderHook(() => useShellContext(config));
  expect(result.current?.user).toEqual({ sub: 's1', username: 'martin', email: 'm@example.com' });
  expect(result.current?.env).toBe('sandbox');
  await expect(result.current?.getAccessToken()).resolves.toBe('at');
  await expect(result.current?.getIdToken()).resolves.toBe('id-at');
  expect(auth.signinSilent).not.toHaveBeenCalled();
});

test('renews a nearly expired token once, however many callers ask', async () => {
  auth.user = user(10);
  let resolve!: (u: unknown) => void;
  auth.signinSilent.mockReturnValue(new Promise((r) => (resolve = r)));
  const { result } = renderHook(() => useShellContext(config));

  const a = result.current!.getAccessToken();
  const b = result.current!.getAccessToken();
  resolve(user(3600, 'renewed'));

  await expect(a).resolves.toBe('renewed');
  await expect(b).resolves.toBe('renewed');
  expect(auth.signinSilent).toHaveBeenCalledTimes(1);
});

test('reports an expired session when silent renew gives up', async () => {
  auth.user = user(0);
  auth.signinSilent.mockResolvedValue(null);
  const { result } = renderHook(() => useShellContext(config));

  await expect(result.current!.getAccessToken()).rejects.toThrow('Session expired');
});

test('fetches AWS credentials with the current id token', async () => {
  const fetchMock = vi.fn(async (_u: string, init: RequestInit) => {
    const target = (init.headers as Record<string, string>)['X-Amz-Target'];
    const body = target.endsWith('GetId')
      ? { IdentityId: 'id' }
      : {
          Credentials: {
            AccessKeyId: 'AK',
            SecretKey: 'SK',
            SessionToken: 'ST',
            Expiration: Date.now() / 1000 + 3600,
          },
        };
    return new Response(JSON.stringify(body));
  });
  vi.stubGlobal('fetch', fetchMock);
  const { result } = renderHook(() => useShellContext(config));

  await expect(result.current!.getAwsCredentials('eu-west-2:pool')).resolves.toMatchObject({
    accessKeyId: 'AK',
  });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).Logins).toEqual({
    'cognito-idp.eu-west-2.amazonaws.com/pool': 'id-at',
  });
  vi.unstubAllGlobals();
});

test('sign-out marks the shell as signing out, drops the user and goes to Cognito logout', async () => {
  const assign = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign, origin: 'https://app.example' });
  const { result } = renderHook(() => useShellContext(config));

  result.current!.signOut();

  expect(isSigningOut()).toBe(true);
  await vi.waitFor(() => expect(assign).toHaveBeenCalled());
  expect(auth.removeUser).toHaveBeenCalled();
  expect(assign.mock.calls[0][0]).toContain('https://login.example/logout?client_id=client');
  vi.unstubAllGlobals();
});
