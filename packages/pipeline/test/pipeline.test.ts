import "source-map-support/register";

import * as cdk from "aws-cdk-lib";

import {
  ParameterValueType,
  StringParameter,
} from "aws-cdk-lib/aws-ssm";

import { withPipeline } from "../lib/Pipeline";
import { withOrganizationsStackSet } from "../lib/OrganizationsStackSet";
import { withIndependentStackSet } from "../lib/IndependentStackSet";

import * as assertions from "aws-cdk-lib/assertions";
import { Construct } from "constructs";

const withApp = (cdkScope: cdk.Stack) => {
  new Construct(cdkScope, "Construct");
};

test("Pipeline created with orgs stack set", () => {
  const app = new cdk.App();

  const pipelineStack = new cdk.Stack(app, "PipelineStack");

  const deployStage = new cdk.Stage(
    pipelineStack,
    "DeployStackSetsStage",
    { stageName: "DeployStackSets" }
  );

  withDeployStacks(deployStage);

  withPipeline(pipelineStack, { deployStage });

  // Singleton, used for clarity
  function withDeployStacks(cdkScope: cdk.Stage) {
    const contextStack = new cdk.Stack(
      cdkScope,
      "ContextStack"
    );

    const world =
      StringParameter.valueForTypedStringParameterV2(
        contextStack,
        "/pipeline/testing-deploy/world",
        ParameterValueType.STRING
      );

    const testingAccountId =
      StringParameter.valueForTypedStringParameterV2(
        contextStack,
        "/pipeline/testing-deploy/account-id",
        ParameterValueType.STRING
      );

    const testingRegion =
      StringParameter.valueForTypedStringParameterV2(
        contextStack,
        "/bootstrap-pipeline/testing-deploy/region",
        ParameterValueType.STRING
      );

    const testingOuId =
      StringParameter.valueForTypedStringParameterV2(
        contextStack,
        "/bootstrap-pipeline/testing-deploy/ou-id",
        ParameterValueType.STRING
      );

    const adminAppRootStack = new cdk.Stack(
      cdkScope,
      "AdminAppRootStack"
    );

    withOrganizationsStackSet<"Hello" | "Goodbye">(
      adminAppRootStack,
      {
        withApp,
        defaultParameters: {
          Hello: world,
          Goodbye: "",
        },
        targets: [
          {
            organizationalUnitId: testingOuId,
            accounts: [testingAccountId],
            regions: [testingRegion],
            parameters: {
              Goodbye: "Universe",
            },
          },
        ],
      }
    );

    return { deployStage: cdkScope };
  }

  const template =
    assertions.Template.fromStack(pipelineStack);

  template.hasResource("AWS::CodePipeline::Pipeline", {});
});

test("Pipeline created with indie stack set", () => {
  const app = new cdk.App();

  const pipelineStack = new cdk.Stack(app, "PipelineStack");

  const deployStage = new cdk.Stage(
    pipelineStack,
    "DeployStackSetsStage",
    { stageName: "DeployStackSets" }
  );

  withDeployStacks(deployStage);

  withPipeline(pipelineStack, { deployStage });

  // Singleton, used for clarity
  function withDeployStacks(cdkScope: cdk.Stage) {
    const contextStack = new cdk.Stack(
      cdkScope,
      "ContextStack"
    );

    const world =
      StringParameter.valueForTypedStringParameterV2(
        contextStack,
        "/pipeline/testing-deploy/world",
        ParameterValueType.STRING
      );

    const testingAccountId =
      StringParameter.valueForTypedStringParameterV2(
        contextStack,
        "/pipeline/testing-deploy/account-id",
        ParameterValueType.STRING
      );

    const testingRegion =
      StringParameter.valueForTypedStringParameterV2(
        contextStack,
        "/bootstrap-pipeline/testing-deploy/region",
        ParameterValueType.STRING
      );

    const adminAppRootStack = new cdk.Stack(
      cdkScope,
      "AdminAppRootStack"
    );

    withIndependentStackSet<"Hello" | "Goodbye">(
      adminAppRootStack,
      {
        withApp,
        defaultParameters: {
          Hello: world,
          Goodbye: "",
        },
        targets: [
          {
            accounts: [testingAccountId],
            regions: [testingRegion],
            parameters: {
              Goodbye: "Universe",
            },
          },
        ],
      }
    );

    return { deployStage: cdkScope };
  }

  const template =
    assertions.Template.fromStack(pipelineStack);

  template.hasResource("AWS::CodePipeline::Pipeline", {});
});
