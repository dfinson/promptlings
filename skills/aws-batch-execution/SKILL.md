---
name: aws-batch-execution
description: Offload finite work to AWS using an existing AWS Batch queue, a standalone ECS task on Fargate, or an already compatible Lambda function. Use to choose the primitive, correlate submission, diagnose a stopped task or recover results. Not for provisioning an AWS environment or deploying a service.
---

# Run finite work on AWS

Use the primitive the workload already fits. Choose **AWS Batch** when a queue and job definition exist and scheduling or retries belong to Batch. Use **ECS RunTask** for a standalone container on an existing cluster. Use **Lambda** only for a function with the expected invocation contract, not because its deployment package happens to be an image.

Bind the approved account, profile or role, and region. Check `aws sts get-caller-identity` with that selection and carry it on every call. Confirm the exact definition revision or function version, runtime limits, input version, output destination and permitted workload identity. For large files, pass references and return files through a run-specific object prefix such as an approved S3 location. Do not pass credentials in overrides, change IAM, or create queues and clusters to fit these examples.

Set supported remote timeouts. Batch attempt timeouts do not bound queue time or all retries, and an ECS waiter does not stop a task.

For an unproved publication path, use the `remote-container-jobs` batch preflight: the workload identity writes an authorized marker and the caller reads it before launch. Batch submission and ordinary Lambda invocation do not accept a client idempotency token. Set `AWS_RETRY_MODE=standard` and `AWS_MAX_ATTEMPTS=1` in those launch processes only. Observation calls can keep their normal retries.

## AWS Batch: identify the job and its attempts

Pass the approved queue and **revision** of the definition. Put the unique run key in the job name and supply inputs using the definition's declared parameters. Capture the response's `jobId`. Batch does not enforce uniqueness of job names.

```text
aws batch submit-job --profile PROFILE --region REGION --job-name RUN_NAME --job-queue QUEUE --job-definition DEFINITION_REVISION
aws batch describe-jobs --profile PROFILE --region REGION --jobs JOB_ID
```

Only `SUCCEEDED` and `FAILED` are terminal. After an unsuccessful attempt, a retriable job can return to `RUNNABLE`. Inspect the final status and reason, the relevant attempt's container exit information, and its CloudWatch log stream if configured. For an array job, correlate child index and attempt with each required output. A failed submission response is not proof that no job was created. Reconcile an ambiguous submission rather than submitting the same name again.

## ECS: stopped does not mean successful

Use an approved request specifying the cluster, task definition revision, Fargate launch type or capacity provider, network configuration and per-run inputs. Use one stable client token for retries of the **same request**. Do not change the request under that token. Treat the reviewed request file as configuration, not a place to store secret values.

```text
aws ecs run-task --profile PROFILE --region REGION --cli-input-json file://REQUEST.json --client-token RUN_TOKEN
aws ecs wait tasks-stopped --profile PROFILE --region REGION --cluster CLUSTER --tasks TASK_ARN
aws ecs describe-tasks --profile PROFILE --region REGION --cluster CLUSTER --tasks TASK_ARN
```

Inspect both `failures` and every returned `taskArn` at launch. Do not wait on a missing ARN. The waiter only establishes `STOPPED` and its own timeout does not stop the task. Inspect `stopCode`, `stoppedReason`, then `exitCode` and `reason` for the named workload container. A task can stop before that container ever starts. Read the task definition's configured log destination and correlate it with the task ID, not with the latest stream.

## Lambda: inspect the invocation response

Use a numbered function version and an approved event payload. Check the invocation mode, timeout and output size first. Choose **one** launch form. For an ordinary synchronous function only, use the single-attempt settings above, `READ_SECONDS` longer than the function timeout and a fresh local response file:

```text
aws lambda invoke --profile PROFILE --region REGION --function-name QUALIFIED_ARN --invocation-type RequestResponse --cli-read-timeout READ_SECONDS --payload fileb://EVENT.json RESPONSE.json
```

If this ordinary invocation loses its response, a run key in the event is not a recoverable execution ID. Lambda's default logs record an AWS request ID, not the event key. Use independent evidence, such as a workload result or log recording the key and outcome. Without it, report the outcome unknown and do not retry.

For a directly invoked **durable function**, record a unique `EXECUTION_NAME`, the numbered function ARN and the immutable event **before the first request**. Supply that name on the initial call and reuse it with the same payload and target for retries within retention. An unnamed retry, or reuse after retention expires, can start another execution. The name deduplicates starts, not individual step effects. For work that fits the durable synchronous limit, set `READ_SECONDS` longer than the allowed synchronous execution time:

```text
aws lambda invoke --profile PROFILE --region REGION --function-name QUALIFIED_ARN --durable-execution-name EXECUTION_NAME --invocation-type RequestResponse --cli-read-timeout READ_SECONDS --payload fileb://EVENT.json RESPONSE.json
```

For either synchronous form, check CLI success, `FunctionError`, the executed version and the application response. HTTP 200 with `FunctionError` is a failed invocation. If the workload instead requires asynchronous `Event` invocation, acceptance is not completion. Use it only with an existing way to correlate and observe the final outcome.

For all three paths, verify each declared output independently of provider status. Return the ID or invocation correlation, terminal evidence, diagnostic location and recovered files. Keep failed attempts distinguishable. A redelivery must not overwrite a successful attempt's output.

## When done, tear it down

When done, or on failure, cancellation or timeout, stop active compute for the recorded run. Collect results and remove run-owned temporary resources. Missing output is not a reason to keep compute running.

**Batch:** Terminate the recorded job, including queued work. Verify terminal state for its children and attempts too.

```text
aws batch terminate-job --profile PROFILE --region REGION --job-id JOB_ID --reason "Run cancelled or deadline reached"
aws batch describe-jobs --profile PROFILE --region REGION --jobs JOB_ID
```

**ECS:** Stop every returned task ARN in its cluster and verify `STOPPED`.

```text
aws ecs stop-task --profile PROFILE --region REGION --cluster CLUSTER --task TASK_ARN --reason "Run cancelled or deadline reached"
aws ecs describe-tasks --profile PROFILE --region REGION --cluster CLUSTER --tasks TASK_ARN
```

**Lambda:** Ordinary invocations have no stop API. Wait for completion or the function timeout, accounting for asynchronous retries. Do not change a shared function to cancel one run. For a durable execution, resolve its exact ARN from the recorded version and execution name, then stop it:

```text
aws lambda stop-durable-execution --profile PROFILE --region REGION --durable-execution-arn EXECUTION_ARN
aws lambda get-durable-execution --profile PROFILE --region REGION --durable-execution-arn EXECUTION_ARN
```

Durable `STOPPED` does not interrupt an already-running step. Verify that invocation finished before removing its dependencies. Otherwise report unresolved shutdown and retain those dependencies. See [stopping semantics](https://docs.aws.amazon.com/durable-execution/getting-started/manage-executions/).

Verify temporary resources are removed, preserving shared resources and required outputs. Provider-retained execution history is not active compute. Report anything retained and its next removal action.

[Batch states](https://docs.aws.amazon.com/batch/latest/userguide/job_states.html) | [DescribeJobs](https://docs.aws.amazon.com/cli/latest/reference/batch/describe-jobs.html) | [TerminateJob](https://docs.aws.amazon.com/cli/latest/reference/batch/terminate-job.html) | [RunTask](https://docs.aws.amazon.com/cli/latest/reference/ecs/run-task.html) | [StopTask](https://docs.aws.amazon.com/cli/latest/reference/ecs/stop-task.html) | [ECS waiter](https://docs.aws.amazon.com/cli/latest/reference/ecs/wait/tasks-stopped.html) | [Lambda invocation](https://docs.aws.amazon.com/lambda/latest/dg/invocation-sync.html) | [Durable execution names](https://docs.aws.amazon.com/lambda/latest/dg/durable-execution-idempotency.html) | [Stop durable execution](https://docs.aws.amazon.com/cli/latest/reference/lambda/stop-durable-execution.html)
