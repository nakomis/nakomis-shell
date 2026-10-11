import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { appDomain, type DeployEnv, EXTERNAL_REMOTE_REPOS, REMOTES, ZONES } from './env-config';
import { MANAGED_LOGIN_SETTINGS } from './managed-login-branding';

export interface ShellStackProps extends cdk.StackProps {
  deployEnv: DeployEnv;
  certificate: acm.ICertificate;
  githubOidcProviderArn: string;
}

const GITHUB_OWNER = { name: 'nakomis', id: '1488244' };
const SHELL_REPO = { name: 'nakomis-shell', id: '1414579904' };

export const githubSubjects = (repo: { name: string; id: string }) => [
  `repo:${GITHUB_OWNER.name}@${GITHUB_OWNER.id}/${repo.name}@${repo.id}:*`,
  `repo:${GITHUB_OWNER.name}/${repo.name}:*`,
];

/**
 * app.{zone}: the shell SPA and every remote, from one bucket behind one CloudFront distribution.
 *   shell/…           the host app (deployed by this repo's CI)
 *   remotes/{name}/…  each remote's build (deployed by that remote's CI, via the remote-deployer policy)
 *   config/…          per-env runtime config written by this stack
 */
export class ShellStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ShellStackProps) {
    super(scope, id, props);

    const { deployEnv } = props;
    const domainName = appDomain(deployEnv);
    const isProd = deployEnv === 'prod';

    // ── Cognito app client on the shared nakomis-infra pool ────────────────
    const userPoolId = ssm.StringParameter.valueForStringParameter(
      this,
      `/nakomis-infra/${deployEnv}/cognito/user-pool-id`,
    );
    const loginDomain = ssm.StringParameter.valueForStringParameter(
      this,
      `/nakomis-infra/${deployEnv}/cognito/login-domain`,
    );
    const userPool = cognito.UserPool.fromUserPoolId(this, 'SharedUserPool', userPoolId);

    const client = userPool.addClient('ShellClient', {
      userPoolClientName: `nakomis-shell-${deployEnv}`,
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [`https://${domainName}/loggedin`, 'http://localhost:5173/loggedin'],
        logoutUrls: [`https://${domainName}/`, 'http://localhost:5173/'],
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    });

    new cognito.CfnManagedLoginBranding(this, 'ShellManagedLoginBranding', {
      userPoolId,
      clientId: client.userPoolClientId,
      useCognitoProvidedValues: false,
      settings: MANAGED_LOGIN_SETTINGS,
    });

    // ── Hosting ────────────────────────────────────────────────────────────
    const bucket = new s3.Bucket(this, 'ShellBucket', {
      bucketName: `nakomis-shell-${deployEnv}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
      lifecycleRules: [{ noncurrentVersionExpiration: cdk.Duration.days(30) }],
    });

    const rewrite = new cloudfront.Function(this, 'RewriteFunction', {
      functionName: `nakomis-shell-rewrite-${deployEnv}`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromFile({ filePath: path.join(__dirname, '../functions/rewrite.js') }),
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `nakomis-shell (${deployEnv})`,
      domainNames: [domainName],
      certificate: props.certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        // Honours the Cache-Control set at upload: no-cache for index.html, remoteEntry.js and config.
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [{ function: rewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
    });

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', ZONES[deployEnv]);
    const aliasTarget = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));
    new route53.ARecord(this, 'AliasA', { zone, recordName: domainName, target: aliasTarget });
    new route53.AaaaRecord(this, 'AliasAaaa', { zone, recordName: domainName, target: aliasTarget });

    // ── Runtime config ─────────────────────────────────────────────────────
    new s3deploy.BucketDeployment(this, 'RuntimeConfig', {
      destinationBucket: bucket,
      destinationKeyPrefix: 'config/',
      sources: [
        s3deploy.Source.jsonData('shell.json', {
          env: deployEnv,
          region: this.region,
          userPoolId,
          clientId: client.userPoolClientId,
          loginDomain,
        }),
        s3deploy.Source.jsonData('remotes.json', REMOTES[deployEnv]),
      ],
      cacheControl: [s3deploy.CacheControl.noCache()],
      prune: false,
      distribution,
      distributionPaths: ['/config/*'],
    });

    // ── CI ─────────────────────────────────────────────────────────────────
    const distributionArn = `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`;

    // Attached by each remote's CI role so it can publish its build under remotes/.
    const remoteDeployer = new iam.ManagedPolicy(this, 'RemoteDeployerPolicy', {
      managedPolicyName: `nakomis-shell-remote-deployer-${deployEnv}`,
      description: 'Publish a Module Federation remote into the shell bucket and invalidate it',
      statements: [
        // Remotes run in the shell's origin, so remote CI is trusted with the whole app.
        new iam.PolicyStatement({
          actions: ['s3:PutObject'],
          resources: [bucket.arnForObjects('remotes/*')],
        }),
        new iam.PolicyStatement({
          actions: ['s3:ListBucket'],
          resources: [bucket.bucketArn],
          conditions: { StringLike: { 's3:prefix': ['remotes/*'] } },
        }),
        new iam.PolicyStatement({ actions: ['cloudfront:CreateInvalidation'], resources: [distributionArn] }),
        // deploy-static.yml looks up the bucket and distribution here.
        new iam.PolicyStatement({
          actions: ['ssm:GetParameter'],
          resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/nakomis-shell/${deployEnv}/*`],
        }),
      ],
    });

    const oidc = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(this, 'GithubOidc', props.githubOidcProviderArn);
    const ciRole = new iam.Role(this, 'ShellCiRole', {
      roleName: `nakomis-nakomis-shell-github-ci-${deployEnv}`,
      description: `Assumed by nakomis-shell GitHub Actions CI (${deployEnv})`,
      assumedBy: new iam.WebIdentityPrincipal(oidc.openIdConnectProviderArn, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        StringLike: { 'token.actions.githubusercontent.com:sub': githubSubjects(SHELL_REPO) },
      }),
    });
    ciRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*`],
      }),
    );
    ciRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject'],
        resources: [bucket.arnForObjects('shell/*')],
      }),
    );
    ciRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [bucket.bucketArn],
        conditions: { StringLike: { 's3:prefix': ['shell/*', 'shell'] } },
      }),
    );
    ciRole.addToPolicy(new iam.PolicyStatement({ actions: ['cloudfront:CreateInvalidation'], resources: [distributionArn] }));
    ciRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/nakomis-shell/${deployEnv}/*`],
      }),
    );

    for (const repo of EXTERNAL_REMOTE_REPOS) {
      new iam.Role(this, `RemoteCiRole-${repo.name}`, {
        roleName: `nakomis-${repo.name}-remote-ci-${deployEnv}`,
        description: `Lets ${repo.name} CI publish its nakomis-shell remote (${deployEnv})`,
        assumedBy: new iam.WebIdentityPrincipal(oidc.openIdConnectProviderArn, {
          StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
          StringLike: { 'token.actions.githubusercontent.com:sub': githubSubjects(repo) },
        }),
        managedPolicies: [remoteDeployer],
      });
    }

    // ── Exports ────────────────────────────────────────────────────────────
    const params: Record<string, string> = {
      'cognito/client-id': client.userPoolClientId,
      'cognito/user-pool-id': userPoolId,
      'bucket-name': bucket.bucketName,
      'distribution-id': distribution.distributionId,
      'app-url': `https://${domainName}`,
      'remote-deployer-policy-arn': remoteDeployer.managedPolicyArn,
    };
    for (const [name, value] of Object.entries(params)) {
      new ssm.StringParameter(this, `Param-${name.replace(/\W/g, '-')}`, {
        parameterName: `/nakomis-shell/${deployEnv}/${name}`,
        stringValue: value,
      });
    }

    new cdk.CfnOutput(this, 'AppUrl', { value: `https://${domainName}` });
    new cdk.CfnOutput(this, 'ClientId', { value: client.userPoolClientId });
    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName });
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new cdk.CfnOutput(this, 'CiRoleArn', { value: ciRole.roleArn });
  }
}

/** Exposed for tests. */
export const REWRITE_FUNCTION_SOURCE = () => fs.readFileSync(path.join(__dirname, '../functions/rewrite.js'), 'utf-8');
