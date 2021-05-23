import {Cluster, ContainerImage, FargateService, FargateTaskDefinition} from '@aws-cdk/aws-ecs';
import {EcsPublicDiscovery} from '../lib';
import {HostedZone} from '@aws-cdk/aws-route53';
import {Stack} from '@aws-cdk/core';
import {SynthUtils} from '@aws-cdk/assert';

test('Snapshot', () => {
    const stack = new Stack();
    const taskDefinition = new FargateTaskDefinition(stack, 'TestTaskDefinition');

    taskDefinition.addContainer('TestContainer', {
        image: ContainerImage.fromRegistry('hello-world')
    });

    const cluster = new Cluster(stack, 'TestCluster');
    const service = new FargateService(stack, 'TestService', {
        assignPublicIp: true,
        cluster,
        taskDefinition
    });

    const hostedZone = HostedZone.fromHostedZoneId(stack, 'HostedZone', 'test-hosted-zone');

    new EcsPublicDiscovery(stack, 'EcsPublicDiscovery', {
        hostedZone,
        name: 'test',
        service
    });

    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot({
        Parameters: expect.any(Object),
        Resources: {
            EcsPublicDiscoveryfunction23A3479F: {
                Properties: {
                    Code: expect.any(Object)
                }
            }
        }
    });
});
