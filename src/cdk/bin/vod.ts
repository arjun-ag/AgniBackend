#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MyVodAppStack } from '../lib/vod-stack';

const app = new cdk.App();
new MyVodAppStack(app, 'MyVodAppStack', {
    env: { 
      account: process.env.CDK_DEFAULT_ACCOUNT, 
      region: process.env.CDK_DEFAULT_REGION 
    }
  });