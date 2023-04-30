#!/usr/bin/env node

require("dotenv").config();

import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { Repository } from "aws-cdk-lib/aws-codecommit";
import { Construct } from "constructs";
import {
  CodePipeline,
  CodePipelineSource,
  ShellStep,
} from "aws-cdk-lib/pipelines";
import {
  BuildSpec,
  LinuxBuildImage,
} from "aws-cdk-lib/aws-codebuild";
import {
  StackSet,
  StackSetStack,
  StackSetTarget,
  StackSetTemplate,
} from "cdk-stacksets";

import addApp from "app/lib/addResources";

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
    "DeployStackSet"
  );

  const appStack = new cdk.Stack(deployStage, "AppStack");

  addApp(appStack);

  const appStackSetStack = new StackSetStack(
    appStack,
    "AppStackSetStack"
  );

  new StackSet(appStack, "StackSet", {
    target: StackSetTarget.fromAccounts({
      accounts: [],
      regions: [],
    }),
    template: StackSetTemplate.fromStackSetStack(
      appStackSetStack
    ),
  });

  pipeline.addStage(deployStage);

  new cdk.CfnOutput(cdkScope, "SourceCodeRepoCloneUrlGrc", {
    value: sourceCodeRepo.repositoryCloneUrlGrc,
  });
}
