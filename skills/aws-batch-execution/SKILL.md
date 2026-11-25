---
name: aws-batch-execution
description: Offload finite work to AWS using an existing AWS Batch queue, a standalone ECS task on Fargate, or an already compatible Lambda function. Use to choose the primitive, correlate submission, diagnose a stopped task or recover results. Not for provisioning an AWS environment or deploying a service.
---

# Run finite work on AWS

Use the primitive the workload already fits. Choose **AWS Batch** when a queue and job definition exist and scheduling or retries belong to Batch. Use **ECS RunTask** for a standalone container on an existing cluster. Use **Lambda** only for a function with the expected invocation contract, not because its deployment package happens to be an image.

Bind the approved account, profile or role, and region. Check `aws sts get-caller-identity` with that selection and carry it on every call. Confirm the exact definition revision or function version, runtime limits, input version, output destination and permitted workload identity. For large files, pass references and return files through a run-specific object prefix such as an approved S3 location. Do not pass credentials in overrides, change IAM, or create queues and clusters to fit these examples.

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

Use a version-qualified function ARN with an approved event payload. Check its configured timeout, supported invocation mode and output size first. For a synchronous request, choose `READ_SECONDS` longer than the function timeout and a fresh local response file:

```text
aws lambda invoke --profile PROFILE --region REGION --function-name QUALIFIED_ARN --invocation-type RequestResponse --cli-read-timeout READ_SECONDS --payload fileb://EVENT.json RESPONSE.json
```

Check CLI success, `FunctionError`, the executed version and the application response. HTTP 200 with `FunctionError` is a failed invocation. An asynchronous `Event` acceptance is not completion. Use it only if there is an existing, correlated completion or failure destination. Never invoke again solely because the client disconnected.

For ordinary synchronous invocations, a run key in the event is not a recoverable execution ID. Lambda's default logs record an AWS request ID, not the event key. If the response is lost, use independent evidence, such as a workload result or log that records the run key and outcome. Without it, report the outcome unknown and do not retry. For a directly invoked **durable function**, `--durable-execution-name` is a provider idempotency key for starting that execution with the same payload within retention. It does not make the function's individual steps exactly once.

For all three paths, verify each declared output independently of provider status. Return the ID or invocation correlation, terminal evidence, diagnostic location and recovered files. Keep failed attempts distinguishable. A redelivery must not overwrite a successful attempt's output. Limit any authorized cancellation and teardown to the recorded run, not a shared definition, function, queue or cluster.

[Batch states](https://docs.aws.amazon.com/batch/latest/userguide/job_states.html) | [DescribeJobs](https://docs.aws.amazon.com/cli/latest/reference/batch/describe-jobs.html) | [RunTask](https://docs.aws.amazon.com/cli/latest/reference/ecs/run-task.html) | [ECS waiter](https://docs.aws.amazon.com/cli/latest/reference/ecs/wait/tasks-stopped.html) | [Lambda invocation](https://docs.aws.amazon.com/lambda/latest/dg/invocation-sync.html) | [Durable execution names](https://docs.aws.amazon.com/lambda/latest/dg/durable-execution-idempotency.html)
