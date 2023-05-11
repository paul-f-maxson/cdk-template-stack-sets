import * as cdk from "aws-cdk-lib";
import {
  StackSetStack,
  StackSetTemplate,
} from "cdk-stacksets";
import { CfnStackSet } from "aws-cdk-lib";

type OrganizationsStackSetTarget<
  ParameterKeys extends string
> = {
  organizationalUnitId: string;
  /**
   * @summary An array of aws account IDs for the environments where the Stack Set will be deployed.
   */
  accounts: string[];
  /**
   * @summary An array of aws regions for the environments where the Stack Set will be deployed
   */
  regions: string[];
  /**
   * @summary CFN Parameter values that will be passed to stack instances, overriding defaultParameters
   */
  parameters?: Partial<Record<ParameterKeys, string>>;
};

declare type OrganizationsStackSetProps<
  ParameterKeys extends string
> = {
  /**
   * @summary A callback that adds arbitrary resources to the Stack Set stack
   * @param stack The stack to which resources will be added
   */
  withApp: (stack: cdk.Stack) => void;
  /**
   * @summary CFN Parameter values that will be passed to stack instances. Overriden by parameters specified at the target level.
   */
  defaultParameters: Record<ParameterKeys, string>;
  /**
   * @summary Environment where stack instances will be located
   * @description Instances will be created in all regions given for all accounts given, so long as those accounts are in the specified organization.
   */
  targets: OrganizationsStackSetTarget<ParameterKeys>[];
};

export function withOrganizationsStackSet<
  ParameterKeys extends string
>(
  cdkScope: cdk.Stack,
  {
    withApp,
    defaultParameters,
    targets,
  }: OrganizationsStackSetProps<ParameterKeys>
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
    permissionModel: "SERVICE_MANAGED",
    callAs: "DELEGATED_ADMIN",
    capabilities: ["CAPABILITY_NAMED_IAM"],
    parameters: Object.entries<string>(
      defaultParameters as Record<ParameterKeys, string>
    ).map(([parameterKey, parameterValue]) => ({
      parameterKey,
      parameterValue,
      creationStack: [cdkScope.stackName],
    })),
    autoDeployment: {
      enabled: false,
      creationStack: [cdkScope.stackName],
    },
    stackInstancesGroup: targets.map(
      ({ parameters = {}, ...target }) => ({
        deploymentTargets: {
          organizationalUnitIds: [
            target.organizationalUnitId,
          ],
          accountFilterType: "INTERSECTION",
          accounts: target.accounts,
        },
        regions: target.regions,
        parameterOverrides: Object.entries<string>(
          parameters as Record<ParameterKeys, string>
        ).map(([parameterKey, parameterValue]) => ({
          parameterKey,
          parameterValue,
          creationStack: [cdkScope.stackName],
        })),
        creationStack: [cdkScope.stackName],
      })
    ),
  });

  return {};
}
