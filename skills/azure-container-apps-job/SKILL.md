---
name: azure-container-apps-job
description: Start and inspect a manual Azure Container Apps Job with the Azure CLI. Use for a finite ACA execution, identifying its replicas, diagnosing missing logs or recovering batch artifacts. Not for an ingress-enabled Container App or creating the shared environment.
---

# Run a manual Container Apps Job

Bind the subscription ID, resource group and Job name explicitly. Verify the expected tenant, environment, manual trigger, image, command, timeout, retry limit, parallelism and required successful replicas. Do not change the active subscription or update a shared Job template to pass one run's input. If using an execution template override, verify the whole replacement template, not just the changed fields.

The Job definition can serve many callers. Its name alone does not identify your run. Arrange a unique input and result reference and an approved identity or secret reference before launch. Prefer a run-specific object-store path. An OCI artifact is an alternative only when the workload may push and the caller may pull. Image-pull permission does not establish result-write permission. Do not assume registry administrator credentials or enable them.

For an unproved publication path, use the `remote-container-jobs` batch preflight: the workload identity writes an authorized marker and the caller reads it before launch. Within the run prefix, keep each replica's and retry attempt's files distinct, or use a single publisher that aggregates and checks all expected outputs. One readable file does not prove every producer delivered its result.

## Follow the execution, not the Job's latest entry

Start the authorized run once. The start response names the execution. Record it immediately. The following command shapes assume the installed CLI supports these flags. Substitute the actual names, including any authorized per-run override at start.

```text
az containerapp job start --subscription SUB --resource-group RG --name JOB
az containerapp job execution show --subscription SUB --resource-group RG --name JOB --job-execution-name EXECUTION
az containerapp job replica list --subscription SUB --resource-group RG --name JOB --execution EXECUTION
az containerapp job logs show --subscription SUB --resource-group RG --name JOB --execution EXECUTION --replica REPLICA --container CONTAINER
```

Read the status for that execution until terminal or the observation deadline. `Succeeded` means the configured replica completion requirement was met. `Failed` or `Stopped` is not success. If the start response is lost, reconcile using a run-owned Job or independent correlation evidence. Neither the newest execution of a shared Job nor another `start` is a safe recovery step.

The preview replica and log commands depend on CLI extension support and replica availability. Choose the replica from this execution and the workload container from its template. If replicas have disappeared, query configured retained logs by execution name, or use the workload's published diagnostics. Missing logs are not evidence of exit zero. Do not enable shared logging, install an extension or issue broader credentials as an implicit fallback.

## Return the outcome

Read the declared artifact under the exact run prefix or digest. Report the execution status separately from the workload's exit evidence and verified files. A replica timeout can kill the publisher itself: report the timeout or observed platform state and the missing artifact, not a constructed exit code. Where stopping is authorized, target the execution, not all executions of a shared Job. Remove a Job definition only if this run created and owns it. Leave the environment, registry and other executions intact.

[Job, execution and replica semantics](https://learn.microsoft.com/en-us/azure/container-apps/jobs) | [CLI execution](https://learn.microsoft.com/en-us/cli/azure/containerapp/job/execution) | [Replica discovery](https://learn.microsoft.com/en-us/cli/azure/containerapp/job/replica) | [CLI logs](https://learn.microsoft.com/en-us/cli/azure/containerapp/job/logs)
