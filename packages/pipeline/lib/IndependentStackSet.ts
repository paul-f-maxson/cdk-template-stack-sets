import * as cdk from "aws-cdk-lib";
import {
  StackSetStack,
  StackSetTemplate,
} from "cdk-stacksets";
import { CfnStackSet } from "aws-cdk-lib";

export type Props<
  TParameters extends { [parameterKey: string]: string }
> = {
  withApp: (stack: cdk.Stack) => void;
  defaultParameters: TParameters;
  targets: {
    accounts: [string];
    regions: [string];
    parameters?: TParameters;
  }[];
};

export function withIndependentStackSet<
  TParameters extends { [parameterKey: string]: string }
>(
  cdkScope: cdk.Stack,
  {
    withApp,
    defaultParameters,
    targets,
  }: Props<TParameters>
) {
  const appStackSetStack = new StackSetStack(
    cdkScope,
    "AppStackSetStack"
  );

  withApp(appStackSetStack);

  new CfnStackSet(cdkScope, "StackSet", {
    stackSetName: "AppStackSet",
    templateUrl: StackSetTemplate.fromStackSetStack(
      appStackSetStack
    ).templateUrl,
    permissionModel: "SELF_MANAGED",
    parameters: Object.entries(defaultParameters).map(
      ([parameterKey, parameterValue]) => ({
        parameterKey,
        parameterValue,
        creationStack: [cdkScope.stackName],
      })
    ),
    stackInstancesGroup: targets.map(
      ({ parameters = {}, ...target }) => ({
        deploymentTargets: {
          accounts: target.accounts,
        },
        regions: target.regions,
        parameterOverrides: Object.entries(parameters).map(
          ([parameterKey, parameterValue]) => ({
            parameterKey,
            parameterValue,
            creationStack: [cdkScope.stackName],
          })
        ),
        creationStack: [cdkScope.stackName],
      })
    ),
  });

  return { appStackSetStack };
}
