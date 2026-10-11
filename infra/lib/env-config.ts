export type DeployEnv = 'sandbox' | 'prod';

export const ACCOUNTS: Record<DeployEnv, { account: string; region: string }> = {
  sandbox: { account: '975050268859', region: 'eu-west-2' },
  prod: { account: '637423226886', region: 'eu-west-2' },
};

export const ZONES: Record<DeployEnv, { zoneName: string; hostedZoneId: string }> = {
  sandbox: { zoneName: 'sandbox.nakomis.com', hostedZoneId: 'Z03586633NXU18LFL0JTL' },
  prod: { zoneName: 'nakomis.com', hostedZoneId: 'Z019437529YGFB53BDUGR' },
};

export const appDomain = (env: DeployEnv) => `app.${ZONES[env].zoneName}`;

export interface RemoteDefinition {
  name: string;
  title: string;
  icon: string;
  path: string;
  entry: string;
  href?: string;
}

const remote = (name: string, title: string): RemoteDefinition => ({
  name,
  title,
  icon: name,
  path: `/${name}`,
  entry: `/remotes/${name}/remoteEntry.js`,
});

const link = (name: string, title: string, href: string): RemoteDefinition => ({
  name,
  title,
  icon: name,
  path: `/${name}`,
  entry: '',
  href,
});

// Sidebar order. Apps that aren't remotes yet are links that open in a new tab. The Sandbox remote exists only in the sandbox shell: there is nowhere for it to go in prod.
export const REMOTES: Record<DeployEnv, RemoteDefinition[]> = {
  sandbox: [
    remote('fleet', 'Fleet'),
    remote('bootboots', 'BootBoots'),
    remote('admin', 'Admin'),
    link('scrum', 'Scrum', 'https://scrum.sandbox.nakomis.com'),
    remote('status', 'Status'),
    remote('sandbox', 'Sandbox'),
  ],
  prod: [
    remote('fleet', 'Fleet'),
    remote('admin', 'Admin'),
    link('scrum', 'Scrum', 'https://scrum.nakomis.com'),
    remote('status', 'Status'),
  ],
};

/**
 * Repos with no AWS CDK of their own whose CI publishes a remote: the shell stack gives each a CI role
 * (nakomis-<repo>-remote-ci-<env>) carrying only the remote-deployer policy.
 */
export const EXTERNAL_REMOTE_REPOS = [{ name: 'nakomis-status', id: '1170893569' }];
