#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";

export enum AppParameterNames {
  HELLO = "Hello",
  GOODBYE = "Goodbye",
}

export type AppParameters = {
  [AppParameterNames.HELLO]: string;
  [AppParameterNames.GOODBYE]?: string;
};

export function withApp(cdkScope: cdk.Stack) {
  new cdk.CfnParameter(cdkScope, AppParameterNames.HELLO);
  new cdk.CfnParameter(
    cdkScope,
    AppParameterNames.GOODBYE,
    { default: "CruelWorld" }
  );

  new Bucket(cdkScope, "Bucket");
}
