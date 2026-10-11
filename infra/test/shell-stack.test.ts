import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as vm from 'vm';
import { REMOTES } from '../lib/env-config';
import { ShellCertStack } from '../lib/shell-cert-stack';
import { REWRITE_FUNCTION_SOURCE, ShellStack } from '../lib/shell-stack';

function synth(deployEnv: 'sandbox' | 'prod') {
  const app = new cdk.App();
  const cert = new ShellCertStack(app, 'Cert', {
    env: { account: '123456789012', region: 'us-east-1' },
    deployEnv,
    crossRegionReferences: true,
  });
  const stack = new ShellStack(app, 'Shell', {
    env: { account: '123456789012', region: 'eu-west-2' },
    deployEnv,
    certificate: cert.certificate,
    githubOidcProviderArn: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
    crossRegionReferences: true,
  });
  return { shell: Template.fromStack(stack), cert: Template.fromStack(cert) };
}

describe.each(['sandbox', 'prod'] as const)('%s', (env) => {
  const domain = env === 'prod' ? 'app.nakomis.com' : 'app.sandbox.nakomis.com';
  let shell: Template;
  let cert: Template;
  beforeAll(() => ({ shell, cert } = synth(env)));

  test('certificate for the app domain in us-east-1', () => {
    cert.hasResourceProperties('AWS::CertificateManager::Certificate', { DomainName: domain });
  });

  test('app client on the shared pool with code flow and app callbacks', () => {
    shell.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: `nakomis-shell-${env}`,
      AllowedOAuthFlows: ['code'],
      CallbackURLs: [`https://${domain}/loggedin`, 'http://localhost:5173/loggedin'],
      GenerateSecret: Match.absent(),
    });
    shell.resourceCountIs('AWS::Cognito::ManagedLoginBranding', 1);
  });

  test('private bucket served via OAC with the rewrite function', () => {
    shell.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: `nakomis-shell-${env}`,
      PublicAccessBlockConfiguration: Match.objectLike({ BlockPublicPolicy: true }),
    });
    shell.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Aliases: [domain],
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: 'redirect-to-https',
          FunctionAssociations: [Match.objectLike({ EventType: 'viewer-request' })],
        }),
      }),
    });
    shell.resourceCountIs('AWS::Route53::RecordSet', 2);
  });

  test('remote deployer policy is limited to remotes/', () => {
    shell.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      ManagedPolicyName: `nakomis-shell-remote-deployer-${env}`,
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 's3:PutObject',
            Resource: Match.objectLike({ 'Fn::Join': ['', Match.arrayWith(['/remotes/*'])] }),
          }),
        ]),
      },
    });
  });

  test('CI role trusts this repo by name and by immutable id', () => {
    shell.hasResourceProperties('AWS::IAM::Role', {
      RoleName: `nakomis-nakomis-shell-github-ci-${env}`,
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Condition: Match.objectLike({
              StringLike: {
                'token.actions.githubusercontent.com:sub': [
                  'repo:nakomis@1488244/nakomis-shell@1414579904:*',
                  'repo:nakomis/nakomis-shell:*',
                ],
              },
            }),
          }),
        ],
      },
    });
  });

  test('external repos get a remote-publishing CI role', () => {
    shell.hasResourceProperties('AWS::IAM::Role', {
      RoleName: `nakomis-nakomis-status-remote-ci-${env}`,
      ManagedPolicyArns: Match.anyValue(),
    });
  });

  test('exports client id and deploy targets to SSM', () => {
    for (const name of ['cognito/client-id', 'bucket-name', 'distribution-id', 'remote-deployer-policy-arn']) {
      shell.hasResourceProperties('AWS::SSM::Parameter', { Name: `/nakomis-shell/${env}/${name}` });
    }
  });
});

test('the Sandbox remote is only offered in the sandbox shell', () => {
  expect(REMOTES.sandbox.map((r) => r.name)).toContain('sandbox');
  expect(REMOTES.prod.map((r) => r.name)).not.toContain('sandbox');
});

describe('rewrite function', () => {
  const handler = (() => {
    const context: { handler?: (e: unknown) => { uri: string } } = {};
    vm.runInNewContext(`${REWRITE_FUNCTION_SOURCE()}; this.handler = handler;`, context);
    return (uri: string) => context.handler!({ request: { uri } }).uri;
  })();

  test.each([
    ['/', '/shell/index.html'],
    ['/fleet', '/shell/index.html'],
    ['/fleet/devices/BootBootsThing', '/shell/index.html'],
    ['/loggedin', '/shell/index.html'],
    ['/assets/index-abc.js', '/shell/assets/index-abc.js'],
    ['/favicon.svg', '/shell/favicon.svg'],
    ['/remotes/fleet/remoteEntry.js', '/remotes/fleet/remoteEntry.js'],
    ['/config/remotes.json', '/config/remotes.json'],
    ['/fleet/firmware/1.2.3', '/shell/index.html'],
    ['/fleet/devices/foo.local', '/shell/index.html'],
  ])('%s → %s', (uri, expected) => {
    expect(handler(uri)).toBe(expected);
  });
});
