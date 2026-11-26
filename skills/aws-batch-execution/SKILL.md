---
name: aws-batch-execution
description: Offload finite work to AWS using an existing AWS Batch queue, a standalone ECS task on Fargate, or an already compatible Lambda function. Use to choose the primitive, correlate submission, diagnose a stopped task or recover results. Not for provisioning an AWS environment or deploying a service.
---

# Run finite work on AWS

Use the primitive the workload already fits. Choose **AWS Batch** when a queue and job definition exist and scheduling or retries belong to Batch. Use **ECS RunTask** for a standalone container on an existing cluster. Use **Lambda** only for a function with the expected invocation contract, not because its deployment package happens to be an image.

Bind the approved account, profile or role, and region. Check `aws sts get-caller-identity` with that selection and carry it on every call. Confirm the exact definition revision or function version, runtime limits, input version, output destination and permitted workload identity. For large files, pass references and return files through a run-specific object prefix such as an approved S3 location. Do not pass credentials in overrides, change IAM, or create queues and clusters to fit these examples.

Before launch, record teardown authority and the exact cancellation operation, concrete workload deadline including retries, supported shutdown grace, bounded recovery window and disposition of every run-owned resource. Verify the primitive's remote timeout or an existing authorized deadline mechanism. Batch attempt timeouts do not bound queue time or the whole retry sequence. An ECS waiter does not impose a task runtime limit. Ordinary Lambda has no per-invocation stop API. These limits must be accounted for before promising teardown on client disconnect.

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

## Terminate only the recorded run

Begin teardown when work is no longer needed, on cancellation, failure, interruption or workload deadline. Recheck run correlation and ownership. Stop active compute promptly, then recover published outputs and retained logs within the recovery window. Missing output is not a reason to leave a job or task running.

**Batch:** `terminate-job` also cancels jobs that have not reached `STARTING`. Use it for the recorded job, not a queue-wide operation. Describe the same ID afterwards and verify terminal state. For array jobs, account for all owned children and active attempts.

```text
aws batch terminate-job --profile PROFILE --region REGION --job-id JOB_ID --reason "Run cancelled or deadline reached"
aws batch describe-jobs --profile PROFILE --region REGION --jobs JOB_ID
```

**ECS:** Stop every task ARN returned for this run in its explicit cluster. Verify each reaches `STOPPED` using `describe-tasks`. Check the task's effective stop timeout rather than assuming a universal grace period.

```text
aws ecs stop-task --profile PROFILE --region REGION --cluster CLUSTER --task TASK_ARN --reason "Run cancelled or deadline reached"
aws ecs describe-tasks --profile PROFILE --region REGION --cluster CLUSTER --tasks TASK_ARN
```

**Lambda:** Closing the client does not cancel an ordinary invocation. Rely on its verified function timeout and any existing workload cancellation contract, accounting for asynchronous retries if used. Do not delete the function, change its shared timeout or concurrency, or claim it stopped without outcome evidence. For a durable execution, first resolve and record its exact execution ARN from the qualified version and execution name. Record the invocation's function timeout and cancellation behavior separately from the durable execution timeout. If authorized, stop that ARN and read back its terminal status:

```text
aws lambda stop-durable-execution --profile PROFILE --region REGION --durable-execution-arn EXECUTION_ARN
aws lambda get-durable-execution --profile PROFILE --region REGION --durable-execution-arn EXECUTION_ARN
```

Durable `STOPPED` prevents further invocations but does not interrupt code already executing inside a step. That invocation can continue until its next checkpoint. Require correlated invocation-completion evidence before claiming compute has stopped or removing resources the invocation still uses. If completion cannot be established, report shutdown unresolved and retain those dependencies with an explicit disposition. See [durable execution stopping semantics](https://docs.aws.amazon.com/durable-execution/getting-started/manage-executions/).

Provider-retained execution records are not active compute and need not be deleted to prove shutdown. Account separately for run-owned staging, temporary artifacts and any workload-created resources. Remove only those authorized for deletion, verify absence and preserve the only required output copy. Leave shared definitions, functions, queues, clusters, buckets and log groups intact. For unresolved shutdown or retained recovery material, report exact identities, observed state, cost exposure, reason, owner, next action and concrete expiry or review time. A successful cancellation request is not terminal-state evidence.

[Batch states](https://docs.aws.amazon.com/batch/latest/userguide/job_states.html) | [DescribeJobs](https://docs.aws.amazon.com/cli/latest/reference/batch/describe-jobs.html) | [TerminateJob](https://docs.aws.amazon.com/cli/latest/reference/batch/terminate-job.html) | [RunTask](https://docs.aws.amazon.com/cli/latest/reference/ecs/run-task.html) | [StopTask](https://docs.aws.amazon.com/cli/latest/reference/ecs/stop-task.html) | [ECS waiter](https://docs.aws.amazon.com/cli/latest/reference/ecs/wait/tasks-stopped.html) | [Lambda invocation](https://docs.aws.amazon.com/lambda/latest/dg/invocation-sync.html) | [Durable execution names](https://docs.aws.amazon.com/lambda/latest/dg/durable-execution-idempotency.html) | [Stop durable execution](https://docs.aws.amazon.com/cli/latest/reference/lambda/stop-durable-execution.html)
