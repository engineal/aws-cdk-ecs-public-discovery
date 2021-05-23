/* eslint-disable no-console,no-process-env */
import * as AWS from 'aws-sdk';
import * as xray from 'aws-xray-sdk';
import {EventBridgeHandler} from 'aws-lambda';

const ec2Client = xray.captureAWSClient(new AWS.EC2());
const route53Client = xray.captureAWSClient(new AWS.Route53());

export type ECSTaskStateChangeEvent = {
    attachments?: AWS.ECS.Attachments;
    availabilityZone: string;
    clusterArn: string;
    connectivity: AWS.ECS.Connectivity;
    connectivityAt: string;
    containers?: AWS.ECS.Containers;
    cpu: string;
    createdAt: string;
    desiredStatus: 'RUNNING' | 'STOPPED';
    group: string;
    lastStatus: 'PROVISIONING' | 'PENDING' | 'RUNNING' | 'DEPROVISIONING' | 'STOPPED';
    launchType: AWS.ECS.LaunchType;
    memory: string;
    overrides: AWS.ECS.TaskOverride;
    platformVersion: string;
    pullStartedAt: string;
    pullStoppedAt: string;
    startedAt: string;
    startedBy: string;
    taskArn: string;
    taskDefinitionArn: string;
    updatedAt: string;
    version: number;
}

type ECSTaskStateChangeHandler = EventBridgeHandler<'ECS Task State Change', ECSTaskStateChangeEvent, void>;

const hostedZoneId = process.env.HOSTED_ZONE_ID;

if (!hostedZoneId) {
    throw new Error('HOSTED_ZONE_ID environment variable is not set!');
}

const name = process.env.NAME;

if (!name) {
    throw new Error('NAME environment variable is not set!');
}

export const handler: ECSTaskStateChangeHandler = async event => {
    const networkInterfaceId = event.detail.attachments
        ?.find(attachment => attachment.type === 'eni')?.details
        ?.find(details => details.name === 'networkInterfaceId')?.value;

    if (!networkInterfaceId) {
        throw new Error(`${event.detail.taskArn} does not have a network interface.`);
    }
    const describeNetworkInterfacesResponse = await ec2Client.describeNetworkInterfaces({
        NetworkInterfaceIds: [networkInterfaceId]
    }).promise();
    // eslint-disable-next-line no-magic-numbers
    const publicIp = describeNetworkInterfacesResponse.NetworkInterfaces?.[0].Association?.PublicIp;

    if (!publicIp) {
        throw new Error(`${event.detail.taskArn} does not have a public ip address.`);
    }

    console.log(`Updating ${name} with address: ${publicIp}.`);
    await route53Client.changeResourceRecordSets({
        ChangeBatch: {
            Changes: [{
                Action: 'UPSERT',
                ResourceRecordSet: {
                    Name: `${name}.`,
                    ResourceRecords: [{Value: publicIp}],
                    TTL: 60,
                    Type: 'A'
                }
            }]
        },
        HostedZoneId: hostedZoneId
    }).promise();
};
