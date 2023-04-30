#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";

export default function addResources(cdkScope: cdk.Stack) {
  new Bucket(cdkScope, "Bucket");
}
