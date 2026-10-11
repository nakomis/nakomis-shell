#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ACCOUNTS, type DeployEnv } from '../lib/env-config';
import { ShellCertStack } from '../lib/shell-cert-stack';
import { ShellStack } from '../lib/shell-stack';

const app = new cdk.App();
const deployEnv = (process.env.NPM_ENVIRONMENT ?? 'sandbox') as DeployEnv;
const env = ACCOUNTS[deployEnv];

const cert = new ShellCertStack(app, 'NakomisShellCertStack', {
  env: { account: env.account, region: 'us-east-1' },
  deployEnv,
  crossRegionReferences: true,
});

new ShellStack(app, 'NakomisShellStack', {
  env,
  deployEnv,
  certificate: cert.certificate,
  githubOidcProviderArn: `arn:aws:iam::${env.account}:oidc-provider/token.actions.githubusercontent.com`,
  crossRegionReferences: true,
});

cdk.Tags.of(app).add('MH-Project', 'nakomis-shell');
