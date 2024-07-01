import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3_notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as path from 'path';
import * as s3Deployment from 'aws-cdk-lib/aws-s3-deployment';


export class MyVodAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket for source videos
    const cotsHomeVideoSource = new s3.Bucket(this, 'CotsHomeVideoSource', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // S3 bucket for processed videos
    const cotsHomeVideoDestination = new s3.Bucket(this, 'CotsHomeVideoDestination', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const waywardHomeVideoSource = new s3.Bucket(this, 'WaywardHomeVideoSource', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // S3 bucket for processed videos
    const waywardHomeVideoDestination = new s3.Bucket(this, 'WaywardHomeVideoDestination', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // IAM Role for MediaConvert
    const mediaConvertRole = new iam.Role(this, 'MediaConvertRole', {
      assumedBy: new iam.ServicePrincipal('mediaconvert.amazonaws.com'),
    });

    mediaConvertRole.addToPolicy(
      new iam.PolicyStatement({
        resources: [
          cotsHomeVideoDestination.bucketArn,
          `${cotsHomeVideoDestination.bucketArn}/*`,
          cotsHomeVideoSource.bucketArn,
          `${cotsHomeVideoSource.bucketArn}/*`,
          waywardHomeVideoSource.bucketArn,
          `${waywardHomeVideoSource.bucketArn}/*`,
          waywardHomeVideoDestination.bucketArn,
          `${waywardHomeVideoDestination.bucketArn}/*`,
        ],
        actions: ['s3:GetObject', 's3:PutObject'],
      }),
    );

    // IAM Role for Lambda
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['mediaconvert:CreateJob', 'mediaconvert:DescribeEndpoints'],
      }),
    );

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        resources: [cotsHomeVideoSource.bucketArn, `${cotsHomeVideoSource.bucketArn}/*`, cotsHomeVideoDestination.bucketArn, `${cotsHomeVideoDestination.bucketArn}/*`, waywardHomeVideoSource.bucketArn, `${waywardHomeVideoSource.bucketArn}/*`, waywardHomeVideoDestination.bucketArn, `${waywardHomeVideoDestination.bucketArn}/*`],
        actions: ['s3:*'],
      }),
    );

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['iam:PassRole'],
      }),
    );

    // Lambda function to start MediaConvert job
    const cotsMediaConvertLambda = new lambda.Function(this, 'CotsMediaConvertLambda', {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '../lambda/trigger')),
      environment: {
        DEST_BUCKET: cotsHomeVideoDestination.bucketName,
        MEDIA_CONVERT_ROLE: mediaConvertRole.roleArn,
        ENDPOINT: 'https://mediaconvert.us-east-1.amazonaws.com', // replace with your MediaConvert endpoint
      },
      role: lambdaRole,
    });

    // Grant permissions to the Lambda function
    cotsHomeVideoSource.grantRead(cotsMediaConvertLambda);
    cotsHomeVideoDestination.grantWrite(cotsMediaConvertLambda);

    // Add S3 event notification to trigger the Lambda function
    cotsHomeVideoSource.addEventNotification(s3.EventType.OBJECT_CREATED, new s3_notifications.LambdaDestination(cotsMediaConvertLambda));


    // Lambda function to start MediaConvert job
    const waywardMediaConvertLambda = new lambda.Function(this, 'WaywardMediaConvertLambda', {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '../lambda/trigger')),
      environment: {
        DEST_BUCKET: cotsHomeVideoDestination.bucketName,
        MEDIA_CONVERT_ROLE: mediaConvertRole.roleArn,
        ENDPOINT: 'https://mediaconvert.us-east-1.amazonaws.com', // replace with your MediaConvert endpoint
      },
      role: lambdaRole,
    });

    // Grant permissions to the Lambda function
    waywardHomeVideoSource.grantRead(waywardMediaConvertLambda);
    waywardHomeVideoDestination.grantWrite(waywardMediaConvertLambda);

    // Add S3 event notification to trigger the Lambda function
    waywardHomeVideoSource.addEventNotification(s3.EventType.OBJECT_CREATED, new s3_notifications.LambdaDestination(waywardMediaConvertLambda));

    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI');

    // CloudFront distribution for the processed videos
    const waywardDistribution = new cloudfront.CloudFrontWebDistribution(this, 'WaywardDistribution', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: waywardHomeVideoDestination,
            originAccessIdentity: oai,
          },
          behaviors: [{ isDefaultBehavior: true }],
        },
      ],
    });

    new cdk.CfnOutput(this, 'WaywardHomeCloudFrontURL', {
      value: waywardDistribution.distributionDomainName,
    });


    // CloudFront distribution for the processed videos
    const cotsDistribution = new cloudfront.CloudFrontWebDistribution(this, 'CotsDistribution', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: cotsHomeVideoDestination,
            originAccessIdentity: oai,
          },
          behaviors: [{ isDefaultBehavior: true }],
        },
      ],
    });

    new cdk.CfnOutput(this, 'CotsHomeCloudFrontURL', {
      value:cotsDistribution.distributionDomainName,
    });


/////////////////////////////////////////////////////////////////////////////////////////////////////////


    const sourceBucketAudio = new s3.Bucket(this, 'SourceBucketAudio', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // S3 bucket for processed videos
    const destinationBucketAudio = new s3.Bucket(this, 'DestinationBucketAudio', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // IAM Role for MediaConvert
    const mediaConvertAudioRole = new iam.Role(this, 'MediaConvertAudioRole', {
      assumedBy: new iam.ServicePrincipal('mediaconvert.amazonaws.com'),
    });

    mediaConvertAudioRole.addToPolicy(
      new iam.PolicyStatement({
        resources: [
          sourceBucketAudio.bucketArn,
          `${sourceBucketAudio.bucketArn}/*`,
          destinationBucketAudio.bucketArn,
          `${destinationBucketAudio.bucketArn}/*`,
        ],
        actions: ['s3:GetObject', 's3:PutObject'],
      }),
    );

    // IAM Role for Lambda
    const lambdaAudioRole = new iam.Role(this, 'LambdaAudioRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    lambdaAudioRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['mediaconvert:CreateJob', 'mediaconvert:DescribeEndpoints'],
      }),
    );

    lambdaAudioRole.addToPolicy(
      new iam.PolicyStatement({
        resources: [sourceBucketAudio.bucketArn, `${sourceBucketAudio.bucketArn}/*`, destinationBucketAudio.bucketArn, `${destinationBucketAudio.bucketArn}/*`],
        actions: ['s3:*'],
      }),
    );

    lambdaAudioRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['iam:PassRole'],
      }),
    );

    // Lambda function to start MediaConvert job
    const mediaConvertAudioLambda = new lambda.Function(this, 'MediaConvertAudioLambda', {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '../lambda/triggerAudio')),
      environment: {
        DEST_BUCKET: destinationBucketAudio.bucketName,
        MEDIA_CONVERT_ROLE: mediaConvertAudioRole.roleArn,
        ENDPOINT: 'https://mediaconvert.us-east-1.amazonaws.com', // replace with your MediaConvert endpoint
      },
      role: lambdaRole,
    });

    // Grant permissions to the Lambda function
    sourceBucketAudio.grantRead(mediaConvertAudioLambda);
    destinationBucketAudio.grantWrite(mediaConvertAudioLambda);

    // Add S3 event notification to trigger the Lambda function
    sourceBucketAudio.addEventNotification(s3.EventType.OBJECT_CREATED, new s3_notifications.LambdaDestination(mediaConvertAudioLambda));

    const oaiAudio = new cloudfront.OriginAccessIdentity(this, 'OAIAudio');

    // CloudFront distribution for the processed videos
    const distributionAudio = new cloudfront.CloudFrontWebDistribution(this, 'DistributionAudio', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: destinationBucketAudio,
            originAccessIdentity: oaiAudio,
          },
          behaviors: [{ isDefaultBehavior: true }],
        },
      ],
    });

    new cdk.CfnOutput(this, 'CloudFrontAudioURL', {
      value: distributionAudio.distributionDomainName,
    });

    ///////////////////////////////////////////////////

    const cotsHomeBucket = new s3.Bucket(this, 'CotsHomeBucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Deploy the JSON file to the S3 bucket
    new s3Deployment.BucketDeployment(this, 'deployCotsHome', {
      sources: [s3Deployment.Source.asset(path.join(__dirname, '../../data/cots'))
      ],
      destinationBucket: cotsHomeBucket,
    });

    const waywardHomeBucket = new s3.Bucket(this, 'waywardHomeBucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true, 
    });

    // Deploy the JSON file to the S3 bucket
    new s3Deployment.BucketDeployment(this, 'deployWaywardHome', {
      sources: [s3Deployment.Source.asset(path.join(__dirname, '../../text'))],
      destinationBucket: waywardHomeBucket,
      // destinationKeyPrefix: 'data/', // optional prefix in the destination bucket
    });


    ///////////////////////////////////////////


  }
}
