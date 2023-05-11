import * as cdk from "aws-cdk-lib";
import {
  StackSetStack,
  StackSetTemplate,
} from "cdk-stacksets";
import { CfnStackSet } from "aws-cdk-lib";

type IndependentStackSetTarget<
  ParameterKeys extends string
> = {
  accounts: [string];
  /**
   * @summary An array of aws regions for the environments where the Stack Set will be deployed
   */
  regions: [string];
  /**
   * @summary CFN Parameter values that will be passed to stack instances, overriding defaultParameters
   */
  parameters?: Partial<Record<ParameterKeys, string>>;
};

type IndependentStackSetProps<
  ParameterKeys extends string
> = {
  /**
   * A callback that adds arbitrary resources to the Stack Set stack
   *
   * Note: it is the callers resposibility to provide any CFN parameters that are created on this stack, via defaultParameters and target[parameters]. Otherwise, stack deployment will fail.
   *
   * @param stack The stack to which resources will be added
   */
  withApp: (stack: cdk.Stack) => void;
  /**
   * The Amazon Resource Number (ARN) of the IAM role to use to
   * create this stack set. Specify an IAM role only if you are using
   * customized administrator roles to control which users or groups
   * can manage specific stack sets within the same administrator
   * account.
   *
   * Use customized administrator roles to control which users or
   * groups can manage specific stack sets within the same
   * administrator account. For more information, see Prerequisites:
   * Granting Permissions for Stack Set Operations in the AWS
   * CloudFormation User Guide .
   * @link — http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cloudformation-stackset.html#cfn-cloudformation-stackset-administrationrolearn
   */
  administrationRoleArn?: string;
  /**
   * The name of the IAM execution role to use to create the stack
   * set. If you don't specify an execution role, AWS CloudFormation
   * uses the AWSCloudFormationStackSetExecutionRole role for the
   * stack set operation.
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cloudformation-stackset.html#cfn-cloudformation-stackset-executionrolename
   */
  executionRoleName?: string;
  /**
   * @summary CFN Parameter values that will be passed to stack instances. Overriden by parameters specified at the target level.
   */
  defaultParameters: Record<ParameterKeys, string>;
  /**
   * @summary Environment where stack instances will be located
   * @description Instances will be created in all regions given for all accounts given.
   */
  targets: IndependentStackSetTarget<ParameterKeys>[];
};

export function withIndependentStackSet<
  ParameterKeys extends string
>(
  cdkScope: cdk.Stack,
  {
    withApp,
    administrationRoleArn,
    executionRoleName,
    defaultParameters = {} as Record<ParameterKeys, string>,
    targets,
  }: IndependentStackSetProps<ParameterKeys>
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
    administrationRoleArn,
    executionRoleName,
    parameters: Object.entries<string>(
      defaultParameters as Record<ParameterKeys, string>
    ).map(([parameterKey, parameterValue]) => ({
      parameterKey,
      parameterValue,
      creationStack: [cdkScope.stackName],
    })),
    stackInstancesGroup: targets.map(
      ({ parameters, ...target }) => ({
        deploymentTargets: {
          accounts: target.accounts,
        },
        regions: target.regions,
        parameterOverrides: Object.entries<string>(
          defaultParameters as Record<ParameterKeys, string>
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
