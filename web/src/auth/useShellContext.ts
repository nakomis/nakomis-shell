import { useMemo, useRef } from 'react';
import { useAuth } from 'react-oidc-context';
import { CONTRACT_VERSION, type ShellConfig, type ShellContext } from '../../../contract/shell-contract';
import { AwsCredentialsProvider } from './awsCredentials';

const TOKEN_REFRESH_MARGIN_S = 60;

export function signOutUrl(config: ShellConfig, origin: string) {
  const params = new URLSearchParams({ client_id: config.clientId, logout_uri: `${origin}/` });
  return `https://${config.loginDomain}/logout?${params}`;
}

/** Builds the ShellContext handed to remotes (minus basePath, which depends on the mounted remote). */
export function useShellContext(config: ShellConfig): Omit<ShellContext, 'basePath'> | undefined {
  const auth = useAuth();
  const authRef = useRef(auth);
  authRef.current = auth;
  const credentials = useMemo(() => new AwsCredentialsProvider(config.region, config.userPoolId), [config]);
  const profile = auth.user?.profile;

  return useMemo(() => {
    if (!profile) return undefined;

    // Always read through the ref: remotes hold on to these functions across token renewals.
    const freshUser = async () => {
      const current = authRef.current;
      const user = current.user;
      if (user && (user.expires_in ?? 0) > TOKEN_REFRESH_MARGIN_S) return user;
      const renewed = await current.signinSilent();
      if (!renewed) throw new Error('Session expired; please sign in again');
      return renewed;
    };

    return {
      contractVersion: CONTRACT_VERSION,
      env: config.env,
      region: config.region,
      userPoolId: config.userPoolId,
      user: {
        sub: profile.sub,
        username:
          (profile['cognito:username'] as string | undefined) ?? profile.preferred_username ?? profile.sub,
        email: profile.email,
      },
      getAccessToken: async () => (await freshUser()).access_token,
      getIdToken: async () => {
        const user = await freshUser();
        if (!user.id_token) throw new Error('No id token');
        return user.id_token;
      },
      getAwsCredentials: async (identityPoolId: string) => {
        const user = await freshUser();
        if (!user.id_token) throw new Error('No id token');
        return credentials.get(identityPoolId, user.id_token);
      },
      signOut: () => {
        credentials.clear();
        void authRef.current.removeUser().then(() => {
          window.location.assign(signOutUrl(config, window.location.origin));
        });
      },
    };
  }, [profile, config, credentials]);
}
