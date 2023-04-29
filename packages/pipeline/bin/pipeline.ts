#!/usr/bin/env node

require("dotenv").config();

import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { Repository } from "aws-cdk-lib/aws-codecommit";
import { Construct } from "constructs";

const app = new cdk.App();

const pipelineStack = new cdk.Stack(app, "PipelineStack", {
  env: {
    account: process.env.PIPELINE_ACCOUNT,
    region: process.env.PIPELINE_REGION,
  },
});

addPipeline(pipelineStack);

function addPipeline(cdkScope: Construct) {
  const sourceCodeRepo = new Repository(
    cdkScope,
    "SourceCodeRepo",
    { repositoryName: "SourceCode" }
  );

  new cdk.CfnOutput(cdkScope, "SourceCodeRepoCloneUrlGrc", {
    value: sourceCodeRepo.repositoryCloneUrlGrc,
  });
}
