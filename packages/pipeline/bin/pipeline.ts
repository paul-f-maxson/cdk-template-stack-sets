#!/usr/bin/env node

require("dotenv").config();

import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { Repository } from "aws-cdk-lib/aws-codecommit";
import {
  CodePipeline,
  ShellStep,
  CodePipelineSource,
} from "aws-cdk-lib/pipelines";
import {
  BuildSpec,
  LinuxBuildImage,
} from "aws-cdk-lib/aws-codebuild";
import {
  StackSetStack,
  StackSet,
  StackSetTarget,
  StackSetTemplate,
  DeploymentType,
} from "cdk-stacksets";

import withApp from "app/lib/addResources";
import {
  Role,
  ServicePrincipal,
  PolicyStatement,
  Effect,
} from "aws-cdk-lib/aws-iam";
import {
  ParameterDataType,
  ParameterValueType,
  StringParameter,
} from "aws-cdk-lib/aws-ssm";
import { CfnStackSet } from "aws-cdk-lib";

const app = new cdk.App();

const pipelineStack = new cdk.Stack(app, "PipelineStack", {
  env: {
    account: process.env.PIPELINE_ACCOUNT,
    region: process.env.PIPELINE_REGION,
  },
});

withPipeline(pipelineStack);

function withPipeline(cdkScope: cdk.Stack) {
  const sourceCodeRepo = new Repository(
    cdkScope,
    "SourceCodeRepo",
    { repositoryName: "SourceCode" }
  );

  const pipeline = new CodePipeline(cdkScope, "Pipeline", {
    synth: new ShellStep("Synth", {
      input: CodePipelineSource.codeCommit(
        sourceCodeRepo,
        "master"
      ),
      installCommands: [
        "corepack enable",
        "corepack prepare yarn@3.5.0 --activate",
        "yarn workspaces focus pipeline",
      ],
      commands: [
        "yarn workspace pipeline run cdk synthesize",
      ],
      primaryOutputDirectory: `packages/pipeline/cdk.out`,
    }),
    synthCodeBuildDefaults: {
      partialBuildSpec: BuildSpec.fromObject({
        phases: {
          install: {
            "runtime-versions": { nodejs: "18" },
          },
        },
      }),
    },
    codeBuildDefaults: {
      buildEnvironment: {
        buildImage: LinuxBuildImage.STANDARD_7_0,
      },
    },
  });

  const deployStage = new cdk.Stage(
    cdkScope,
    "DeployStackSetStage",
    { stageName: "DeployStackSet" }
  );

  const { appStackSetStack } = withStackSet(
    new cdk.Stack(deployStage)
  );

  withApp(appStackSetStack);

  pipeline.addStage(deployStage);

  new cdk.CfnOutput(cdkScope, "SourceCodeRepoCloneUrlGrc", {
    value: sourceCodeRepo.repositoryCloneUrlGrc,
  });
}

function withStackSet(cdkScope: cdk.Stack) {
  const appStackSetStack = new StackSetStack(
    cdkScope,
    "AppStackSetStack"
  );

  const stackSetAdminRole = new Role(
    cdkScope,
    "AdminRole",
    {
      assumedBy: new ServicePrincipal(
        "cloudformation.amazonaws.com"
      ),
    }
  );

  stackSetAdminRole.addToPolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["sts:AssumeRole"],
      resources: [
        "arn:aws:iam::*:role/AWSCloudFormationStackSetExecutionRole",
      ],
    })
  );

  new CfnStackSet(cdkScope, "StackSet", {
    stackSetName: "AppStackSet",
    templateUrl: StackSetTemplate.fromStackSetStack(
      appStackSetStack
    ).templateUrl,
    permissionModel: "SELF_MANAGED",
    stackInstancesGroup: [
      {
        creationStack: [cdkScope.stackName],
        deploymentTargets: {
          accounts: [
            StringParameter.valueForTypedStringParameterV2(
              cdkScope,
              "/pipeline/testing-deploy/account-id",
              ParameterValueType.STRING
            ),
          ],
        },
        regions: [
          StringParameter.valueForTypedStringParameterV2(
            cdkScope,
            "/pipeline/testing-deploy/region",
            ParameterValueType.STRING
          ),
        ],
      },
    ],
  });

  return { appStackSetStack };
}
