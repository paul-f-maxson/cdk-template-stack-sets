import * as cdk from "aws-cdk-lib";
import {
  StackSetStack,
  StackSetTemplate,
} from "cdk-stacksets";
import { CfnStackSet } from "aws-cdk-lib";

declare type IndependentStackSetProps<
  TParameters extends Record<string, string> = never
> = {
  /**
   * @summary A callback that adds arbitrary resources to the Stack Set stack
   * @param stack The stack to which resources will be added
   */
  withApp: (stack: cdk.Stack) => void;
  /**
   * @summary CFN Parameter values that will be passed to stack instances. Overriden by parameters specified at the target level.
   */
  defaultParameters: TParameters;
  /**
   * @summary Environment where stack instances will be located
   * @description Instances will be created in all regions given for all accounts given.
   */
  targets: {
    accounts: [string];
    /**
     * @summary An array of aws regions for the environments where the Stack Set will be deployed
     */
    regions: [string];
    /**
     * @summary CFN Parameter values that will be passed to stack instances, overriding defaultParameters
     */
    parameters?: Partial<TParameters>;
  }[];
};

export function withIndependentStackSet<
  TParameters extends Record<string, string> = never
>(
  cdkScope: cdk.Stack,
  {
    withApp,
    defaultParameters,
    targets,
  }: IndependentStackSetProps<TParameters>
) {
  const appStackSetStack = new StackSetStack(
    cdkScope,
    "AppStackSetStack"
  );

  withApp(appStackSetStack);

  new CfnStackSet(cdkScope, "StackSet", {
    stackSetName: `${cdk.Names.uniqueResourceName(
      cdkScope,
      { separator: "-", maxLength: 60 }
    )}-AppStackSet`,
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

  return {};
}
