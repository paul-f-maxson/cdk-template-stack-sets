#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";

const app = new cdk.App();

const stack = new cdk.Stack(app, "Stack");

new Bucket(stack, "Bucket");
