import {Context, EventBridgeEvent} from 'aws-lambda';
import mockedEnv, {RestoreFn} from 'mocked-env';
import {ECSTaskStateChangeEvent} from '../lib/ecs-public-discovery.function';

const mockedDescribeNetworkInterfaces = jest.fn();
const mockedChangeResourceRecordSets = jest.fn();

jest.mock('aws-sdk', () => ({
    EC2: jest.fn(() => ({
        describeNetworkInterfaces: mockedDescribeNetworkInterfaces
    })),
    Route53: jest.fn(() => ({
        changeResourceRecordSets: mockedChangeResourceRecordSets
    }))
}));

jest.mock('aws-xray-sdk', () => ({
    captureAWSClient: <T>(client: T) => client
}));

// eslint-disable-next-line init-declarations
let restore: RestoreFn | undefined;

afterEach(() => {
    if (restore) {
        restore();
    }
});

const testEvent: EventBridgeEvent<'ECS Task State Change', ECSTaskStateChangeEvent> = {
    'account': '123456789012',
    'detail': {
        attachments: [
            {
                details: [
                    {
                        name: 'subnetId',
                        value: 'subnet-0bcadcd53ec6db41b'
                    },
                    {
                        name: 'networkInterfaceId',
                        value: 'eni-0260dcb4dd0dc53a8'
                    },
                    {
                        name: 'macAddress',
                        value: '0e:44:0c:e6:c7:83'
                    },
                    {
                        name: 'privateDnsName',
                        value: 'ip-10-0-72-160.ec2.internal'
                    },
                    {
                        name: 'privateIPv4Address',
                        value: '10.0.72.160'
                    }
                ],
                id: '8c9ede0f-b77e-4ed9-a171-daa092e42e28',
                status: 'ATTACHED',
                type: 'eni'
            }
        ],
        availabilityZone: 'us-east-1a',
        clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/TestCluster',
        connectivity: 'CONNECTED',
        connectivityAt: '2020-11-06T21:46:00.743Z',
        containers: [
            {
                containerArn: 'arn:aws:ecs:us-east-1:123456789012:container/9ee7ddc1-a445-4cdb-a7e0-d753fdb86308',
                cpu: '0',
                image: 'hello-world',
                lastStatus: 'RUNNING',
                name: 'TestContainer',
                networkInterfaces: [
                    {
                        attachmentId: '8c9ede0f-b77e-4ed9-a171-daa092e42e28',
                        privateIpv4Address: '10.0.72.160'
                    }
                ],
                runtimeId: '9b67f8db50a44c2c87821ee0bb66b5a3-2815798255',
                taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/TestCluster/9b67f8db50a44c2c87821ee0bb66b5a3'
            }
        ],
        cpu: '2048',
        createdAt: '2020-11-06T21:45:52.674Z',
        desiredStatus: 'RUNNING',
        group: 'service:TestService',
        lastStatus: 'RUNNING',
        launchType: 'FARGATE',
        memory: '4096',
        overrides: {
            containerOverrides: [
                {
                    name: 'MinecraftContainer'
                },
                {
                    name: 'SftpContainer'
                }
            ]
        },
        platformVersion: '1.4.0',
        pullStartedAt: '2020-11-06T21:46:15.749Z',
        pullStoppedAt: '2020-11-06T21:46:33.749Z',
        startedAt: '2020-11-06T21:46:40.749Z',
        startedBy: 'ecs-svc/8698694698746607723',
        taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/TestCluster/9b67f8db50a44c2c87821ee0bb66b5a3',
        taskDefinitionArn: 'arn:aws:ecs:us-east-1:123456789012:task-definition/VanillaWorldMinecraftTask33FF4883:2',
        updatedAt: '2020-11-06T21:46:40.749Z',
        version: 3
    },
    'detail-type': 'ECS Task State Change',
    'id': '28f04639-8265-b612-cd30-ecd479840c1a',
    'region': 'us-east-1',
    'resources': [
        'arn:aws:ecs:us-east-1:123456789012:task/TestCluster/9b67f8db50a44c2c87821ee0bb66b5a3'
    ],
    'source': 'aws.ecs',
    'time': '2020-11-06T21:46:40Z',
    'version': '0'
};

test('Function updates Route 53 ', async () => {
    restore = mockedEnv({
        HOSTED_ZONE_ID: 'Z1R8UBAEXAMPLE',
        NAME: 'test.example.com'
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
    const lambda = require('../lib/ecs-public-discovery.function');

    mockedDescribeNetworkInterfaces.mockReturnValue({
        promise: () => Promise.resolve({
            NetworkInterfaces: [
                {
                    Association: {
                        PublicIp: '1.2.3.4'
                    }
                }
            ]
        })
    });
    mockedChangeResourceRecordSets.mockReturnValue({
        promise: () => Promise.resolve()
    });

    await lambda.handler(testEvent, null as unknown as Context, jest.fn());

    expect(mockedChangeResourceRecordSets).toBeCalledWith({
        ChangeBatch: {
            Changes: [{
                Action: 'UPSERT',
                ResourceRecordSet: {
                    Name: 'test.example.com.',
                    ResourceRecords: [{Value: '1.2.3.4'}],
                    TTL: 60,
                    Type: 'A'
                }
            }]
        },
        HostedZoneId: 'Z1R8UBAEXAMPLE'
    });
});
