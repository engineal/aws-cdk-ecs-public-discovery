import {Construct, Stack} from '@aws-cdk/core';
import {IBaseService} from '@aws-cdk/aws-ecs';
import {IHostedZone} from '@aws-cdk/aws-route53';
import {LambdaFunction} from '@aws-cdk/aws-events-targets';
import {NodejsFunction} from '@aws-cdk/aws-lambda-nodejs';
import {PolicyStatement} from '@aws-cdk/aws-iam';
import {RetentionDays} from '@aws-cdk/aws-logs';
import {Rule} from '@aws-cdk/aws-events';
import {Tracing} from '@aws-cdk/aws-lambda';

export interface EcsPublicDiscoveryProps {

    /**
     * The ECS service to create DNS entries for
     */
    readonly service: IBaseService

    /**
     * The Route 53 hosted zone to create DNS entries in
     */
    readonly hostedZone: IHostedZone;

    /**
     * Name of service
     */
    readonly name: string;

    /**
     * Enable AWS X-Ray Tracing for Lambda Functions
     *
     * @default Tracing.Disabled
     */
    readonly tracing?: Tracing;
}

export class EcsPublicDiscovery extends Construct {

    constructor(scope: Construct, id: string, props: EcsPublicDiscoveryProps) {
        super(scope, id);

        const route53UpdaterFunction = new NodejsFunction(this, 'function', {
            bundling: {
                minify: true
            },
            environment: {
                HOSTED_ZONE_ID: props.hostedZone.hostedZoneId,
                NAME: props.name
            },
            logRetention: RetentionDays.ONE_YEAR,
            tracing: props.tracing
        });

        route53UpdaterFunction.addToRolePolicy(new PolicyStatement({
            actions: ['ec2:DescribeNetworkInterfaces'],
            resources: ['*']
        }));
        route53UpdaterFunction.addToRolePolicy(new PolicyStatement({
            actions: [
                'route53:ChangeResourceRecordSets'
            ],
            resources: [Stack.of(this).formatArn({
                account: '',
                region: '',
                resource: 'hostedzone',
                resourceName: props.hostedZone.hostedZoneId,
                service: 'route53'
            })]
        }));

        const route53UpdaterFunctionRule = new Rule(this, 'Route53UpdaterFunctionRule', {
            eventPattern: {
                detail: {
                    clusterArn: [props.service.cluster.clusterArn],
                    desiredStatus: ['RUNNING'],
                    group: [`service:${props.service.serviceName}`],
                    lastStatus: ['RUNNING']
                },
                detailType: ['ECS Task State Change'],
                source: ['aws.ecs']
            }
        });

        route53UpdaterFunctionRule.addTarget(new LambdaFunction(route53UpdaterFunction));
    }

}
