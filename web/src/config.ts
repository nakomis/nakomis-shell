import type { RemoteDefinition, ShellConfig } from '../../contract/shell-contract';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return (await res.json()) as T;
}

/** Runtime config written per env by the shell's CDK stack, so one build serves both envs. */
export const loadShellConfig = () => fetchJson<ShellConfig>('/config/shell.json');

export const loadRemoteDefinitions = () => fetchJson<RemoteDefinition[]>('/config/remotes.json');

export const authorityFor = (config: ShellConfig) =>
  `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`;
