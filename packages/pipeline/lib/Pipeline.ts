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

export type PipelineProps = {
  deployStage: cdk.Stage;
};

export function withPipeline(
  cdkScope: cdk.Stack,
  { deployStage }: PipelineProps
) {
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
    useChangeSets: false,
  });

  pipeline.addStage(deployStage);

  new cdk.CfnOutput(cdkScope, "SourceCodeRepoCloneUrlGrc", {
    value: sourceCodeRepo.repositoryCloneUrlGrc,
  });
}
