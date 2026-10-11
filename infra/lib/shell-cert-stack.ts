import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';
import { appDomain, type DeployEnv, ZONES } from './env-config';

export interface ShellCertStackProps extends cdk.StackProps {
  deployEnv: DeployEnv;
}

/** CloudFront certificates must live in us-east-1. */
export class ShellCertStack extends cdk.Stack {
  readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: ShellCertStackProps) {
    super(scope, id, props);
    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', ZONES[props.deployEnv]);
    this.certificate = new acm.Certificate(this, 'AppCert', {
      domainName: appDomain(props.deployEnv),
      validation: acm.CertificateValidation.fromDns(zone),
    });
  }
}
