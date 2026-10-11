import type { AwsCredentials } from '../../../contract/shell-contract';

// Talks to the Cognito Identity JSON API directly rather than pulling in the AWS SDK.

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

async function call<T>(region: string, target: string, body: unknown): Promise<T> {
  const res = await fetch(`https://cognito-identity.${region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityService.${target}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Cognito Identity ${target} failed: ${json.message ?? res.status}`);
  return json as T;
}

interface CacheEntry {
  idToken: string;
  creds: Promise<AwsCredentials>;
}

export class AwsCredentialsProvider {
  private cache = new Map<string, CacheEntry>();

  constructor(
    private readonly region: string,
    private readonly userPoolId: string,
    private readonly now: () => number = Date.now,
  ) {}

  async get(identityPoolId: string, idToken: string): Promise<AwsCredentials> {
    const cached = this.cache.get(identityPoolId);
    if (cached && cached.idToken === idToken) {
      const creds = await cached.creds.catch(() => undefined);
      if (creds && creds.expiration.getTime() - this.now() > REFRESH_MARGIN_MS) return creds;
    }
    const creds = this.fetch(identityPoolId, idToken);
    this.cache.set(identityPoolId, { idToken, creds });
    return creds;
  }

  clear() {
    this.cache.clear();
  }

  private async fetch(identityPoolId: string, idToken: string): Promise<AwsCredentials> {
    const logins = { [`cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`]: idToken };
    const { IdentityId } = await call<{ IdentityId: string }>(this.region, 'GetId', {
      IdentityPoolId: identityPoolId,
      Logins: logins,
    });
    const { Credentials } = await call<{
      Credentials: { AccessKeyId: string; SecretKey: string; SessionToken: string; Expiration: number };
    }>(this.region, 'GetCredentialsForIdentity', { IdentityId, Logins: logins });
    return {
      accessKeyId: Credentials.AccessKeyId,
      secretAccessKey: Credentials.SecretKey,
      sessionToken: Credentials.SessionToken,
      // The JSON API returns epoch seconds.
      expiration: new Date(Credentials.Expiration * 1000),
    };
  }
}
