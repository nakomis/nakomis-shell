import { AwsCredentialsProvider } from './awsCredentials';

const NOW = Date.UTC(2026, 9, 11, 12);

function mockCognito(expirySeconds: number) {
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const target = (init.headers as Record<string, string>)['X-Amz-Target'];
    const body = target.endsWith('GetId')
      ? { IdentityId: 'eu-west-2:abc' }
      : {
          Credentials: { AccessKeyId: 'AK', SecretKey: 'SK', SessionToken: 'ST', Expiration: expirySeconds },
        };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

test('exchanges the id token for credentials via GetId and GetCredentialsForIdentity', async () => {
  const fetchMock = mockCognito(NOW / 1000 + 3600);
  const provider = new AwsCredentialsProvider('eu-west-2', 'eu-west-2_pool', () => NOW);

  const creds = await provider.get('eu-west-2:pool-id', 'id-token');

  expect(creds).toEqual({
    accessKeyId: 'AK',
    secretAccessKey: 'SK',
    sessionToken: 'ST',
    expiration: new Date(NOW + 3600 * 1000),
  });
  const getIdBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
  expect(getIdBody).toEqual({
    IdentityPoolId: 'eu-west-2:pool-id',
    Logins: { 'cognito-idp.eu-west-2.amazonaws.com/eu-west-2_pool': 'id-token' },
  });
});

test('caches credentials until close to expiry', async () => {
  const fetchMock = mockCognito(NOW / 1000 + 3600);
  const provider = new AwsCredentialsProvider('eu-west-2', 'pool', () => NOW);

  await provider.get('p', 't');
  await provider.get('p', 't');

  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('refetches when credentials are about to expire or the token changes', async () => {
  const fetchMock = mockCognito(NOW / 1000 + 60);
  const provider = new AwsCredentialsProvider('eu-west-2', 'pool', () => NOW);

  await provider.get('p', 't');
  await provider.get('p', 't');
  await provider.get('p', 't2');

  expect(fetchMock).toHaveBeenCalledTimes(6);
});

test('surfaces Cognito errors', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ message: 'Invalid login token' }), { status: 400 })),
  );
  const provider = new AwsCredentialsProvider('eu-west-2', 'pool');

  await expect(provider.get('p', 't')).rejects.toThrow('Invalid login token');
});
