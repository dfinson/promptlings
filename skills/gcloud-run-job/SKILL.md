---
name: gcloud-run-job
description: Execute a Google Cloud Run Job with gcloud and recover the results of that execution. Use for task retries, execution-scoped logs, diagnosing missing outputs or distinguishing startup from completion. Not for deploying a Cloud Run web service.
---

# Execute a Cloud Run Job

Use a Job when the container runs a command and exits. It does not need an HTTP listener. Check the approved account, project, region, Job, image, arguments, task count, task timeout, retries and service account. Pass the project and region explicitly rather than changing the active gcloud configuration. A missing or unauthorized Job is not permission to deploy a replacement.

Make the input immutable and choose an output location readable by the caller and writable by the workload. Use a run-specific prefix in an approved bucket where possible. For parallel work, distinguish task index and attempt so that a retry does not overwrite a different task's results. Supply non-secret run inputs as execution overrides when permitted, not as permanent updates to the Job. Do not grant IAM permissions or emit secret values to fix a denied override.

For an unproved publication path, use the `remote-container-jobs` batch preflight: the workload identity writes an authorized marker and the caller reads it before launch.

## Capture this execution

Bind a unique run key to the submission, for example with an authorized `--update-env-vars=OFFLOAD_RUN_ID=RUN_KEY` override for a workload that consumes it. The run API creates an execution per accepted request and has no idempotency key. A transport retry can create a second execution even if you issue only one command. For non-repeatable work, require workload-side deduplication of each logical task's effects across executions and retries. A verified single-attempt submission path can address transport replay, but not task retries. Do not launch unless both are accounted for.

Keep the execution name returned by this invocation. The default command waits for startup, not for completion. `--async` returns earlier. `--wait` waits for completion. The example assumes the workload consumes the override:

```text
gcloud run jobs execute JOB --project PROJECT --region REGION --update-env-vars=OFFLOAD_RUN_ID=RUN_KEY --format="value(metadata.name)"
gcloud run jobs executions describe EXECUTION --project PROJECT --region REGION --format="yaml(metadata.name,status)"
```

After a retry, empty name or disconnect, reconcile **all** executions carrying the run key using their effective overrides or workload evidence. Distinguish their attempts and artifacts by execution name as well as task index. If correlation is inconclusive, report the unknown outcome. Do not submit again or substitute `latestCreatedExecution`, which might belong to another caller.

## Distinguish execution, task and output

Read the exact execution's `Completed` condition, reason and succeeded, failed or cancelled task counts. An unknown condition means the outcome is not final. Inspect failed tasks individually: the v2 Task resource's `lastAttemptResult` supplies status and, when available, `exitCode` **or** `termSignal`. The task timeout applies per attempt. A retry can therefore extend the run beyond one timeout. Do not manufacture an exit code for a task that never started.

Read logs for this execution, not the whole Job. For example, in a shell that accepts single-quoted strings, replace `EXECUTION` inside the filter with the execution's short name:

```text
gcloud run jobs logs read JOB --project PROJECT --region REGION --log-filter='labels."run.googleapis.com/execution_name"="EXECUTION"'
```

On success or failure, retrieve declared files and available diagnostics from the exact run prefix. Report execution name, terminal condition, failed task evidence and which files were verified. A successful execution with a missing required file is an incomplete delivery. Do not delete the shared Job to stop an execution or delete the bucket after collecting one result.

[Execute flags](https://docs.cloud.google.com/sdk/gcloud/reference/run/jobs/execute) | [Execution details](https://docs.cloud.google.com/run/docs/managing/job-executions) | [Task attempt results](https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.jobs.executions.tasks) | [Job logs](https://docs.cloud.google.com/sdk/gcloud/reference/run/jobs/logs/read) | [Google's general Cloud Run skill](https://github.com/GoogleCloudPlatform/cloud-run-mcp/blob/main/skills/cloud-run/SKILL.md)
