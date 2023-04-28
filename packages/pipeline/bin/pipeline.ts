#!/usr/bin/env node

require("dotenv").config();

import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import {
  Artifacts,
  BuildSpec,
  Cache,
  LinuxBuildImage,
  LocalCacheMode,
  PipelineProject,
  Project,
  Source,
} from "aws-cdk-lib/aws-codebuild";
import { Repository } from "aws-cdk-lib/aws-codecommit";
import {
  Artifact,
  Pipeline,
} from "aws-cdk-lib/aws-codepipeline";
import {
  CloudFormationDeployStackSetAction,
  CodeBuildAction,
  CodeCommitSourceAction,
  StackSetTemplate,
} from "aws-cdk-lib/aws-codepipeline-actions";
import { Construct } from "constructs";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { CodeBuildStep } from "aws-cdk-lib/pipelines";

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

  const pipeline = new Pipeline(cdkScope, "Pipeline", {
    crossAccountKeys: false,
  });

  // Source Stage

  const sourceArtifact = new Artifact("Source");

  pipeline.addStage({
    stageName: "Source",
    actions: [
      new CodeCommitSourceAction({
        actionName: "CodeCommit",
        repository: sourceCodeRepo,
        output: sourceArtifact,
      }),
    ],
  });

  //  Pipeline Stage

  const pipelineSource = Source.codeCommit({
    repository: sourceCodeRepo,
    branchOrRef: "refs/tags/pipeline-staging",
  });

  const buildPipeline = new Project(
    cdkScope,
    "PipelineProject",
    {
      source: pipelineSource,
      description:
        "Builds the aws cdk app comprising the pipeline itself",
      artifacts: Artifacts.s3({
        bucket: pipeline.artifactBucket,
      }),
      buildSpec: BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            "runtime-versions": { nodejs: "18.x" },
            commands: [
              "corepack enable",
              "corepack prepare yarn@stable --activate",
            ],
          },
          pre_build: {
            commands: ["yarn workspaces focus pipeline"],
          },
          build: {
            commands: [
              `yarn workspace pipeline run cdk synthesize ${
                /**
                 * Show debug logs
                 * (specify multiple times to increase verbosity)
                 */ ""
              } --verbose --verbose ${
                /**
                 * Enable emission of additional debugging information,
                 * such as creation stack traces of tokens
                 */ ""
              } --debug ${
                /** Print trace for stack warnings */ ""
              } --trace ${
                /** Do not construct stacks with warnings */ ""
              } --strict`,
              ,
            ],
          },
          artifacts: {
            "base-directory": "packages/pipeline/cdk.out",
            files: "**/*",
          },
        },
      }),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_7_0,
      },
      cache: Cache.local(LocalCacheMode.SOURCE),
    }
  );

  const pipelineArtifact = new Artifact("PipelineApp");

  pipeline.addStage({
    stageName: "BuildPipeline",
    actions: [
      new CodeBuildAction({
        actionName: "Build",
        project: buildPipeline,
        input: sourceArtifact,
        outputs: [pipelineArtifact],
      }),
    ],
  });

  // Update Pipeline Stage

  const selfMutateProject = new PipelineProject(
    cdkScope,
    "SelfMutateProject",
    {
      buildSpec: BuildSpec.fromObject({
        phases: {
          install: {
            "runtime-versions": { nodejs: "18.x" },
            commands: [
              "corepack enable",
              "corepack prepare yarn@stable --activate",
            ],
          },
          pre_build: {
            commands: ["yarn workspaces focus pipeline"],
          },
          build: {
            commands: [
              "yarn workspace pipeline run cdk -a . deploy --require-approval=never --verbose",
            ],
          },
        },
      }),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_7_0,
      },
    }
  );

  pipeline.addStage({
    stageName: "UpdatePipeline",
    actions: [
      new CodeBuildAction({
        actionName: "SelfMutate",
        project: selfMutateProject,
        input: pipelineArtifact,
      }),
    ],
  });

  // App Stage

  const appSource = Source.codeCommit({
    repository: sourceCodeRepo,
    branchOrRef: "refs/tags/app-staging",
  });

  const buildApp = new Project(cdkScope, "AppProject", {
    source: appSource,
    description: "Builds the main cdk application",
    artifacts: Artifacts.s3({
      bucket: pipeline.artifactBucket,
    }),
    buildSpec: BuildSpec.fromObject({
      version: "0.2",
      phases: {
        install: {
          "runtime-versions": { nodejs: "18.x" },
          commands: [
            "corepack enable",
            "corepack prepare yarn@stable --activate",
          ],
        },
        pre_build: {
          commands: ["yarn workspaces focus app"],
        },
        build: {
          commands: [
            `yarn workspace app run cdk synthesize ${
              /**
               * Show debug logs
               * (specify multiple times to increase verbosity)
               */ ""
            } --verbose --verbose ${
              /**
               * Enable emission of additional debugging information,
               * such as creation stack traces of tokens
               */ ""
            } --debug ${
              /** Print trace for stack warnings */ ""
            } --trace ${
              /** Do not construct stacks with warnings */ ""
            } --strict`,
          ],
        },
      },
      artifacts: {
        "base-directory": "packages/app/cdk.out",
        files: "**/*",
      },
    }),
    environment: {
      buildImage: LinuxBuildImage.STANDARD_7_0,
    },
  });

  const appArtifact = new Artifact("App");

  pipeline.addStage({
    stageName: "BuildApp",
    actions: [
      new CodeBuildAction({
        actionName: "Build",
        project: buildApp,
        input: sourceArtifact,
        outputs: [appArtifact],
      }),
    ],
  });

  // Deploy Stage

  pipeline.addStage({
    stageName: "Deploy",
    actions: [
      new CloudFormationDeployStackSetAction({
        stackSetName: "AppStackSet",
        actionName: "UpdateStackSet",
        template: StackSetTemplate.fromArtifactPath(
          appArtifact.atPath("Stack.template.json")
        ),
      }),
    ],
  });

  new cdk.CfnOutput(cdkScope, "SourceCodeRepoCloneUrlGrc", {
    value: sourceCodeRepo.repositoryCloneUrlGrc,
  });
}
