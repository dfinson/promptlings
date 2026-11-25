---
name: kubectl-batch-job
description: Use kubectl to submit or diagnose a finite batch/v1 Job on an existing Kubernetes cluster. Use for offloading a command to Pods, tracking retries, interpreting terminal conditions and retrieving outputs. Not for deploying a service or provisioning a cluster.
---

# Run a Kubernetes Job and recover its outputs

Bind the approved context and namespace on **every** API call. Confirm the cluster endpoint and namespace, service account, image digest, inputs, resource requests, timeout, retry policy and result destination. Namespace access is not permission to create a cluster, grant roles, or modify a shared Job.

## Before submission

Use one uniquely named Job per run. Pass non-secret run identifiers and input references to the workload. Use existing secret references or workload identity for protected access. Set the intended `backoffLimit`, `activeDeadlineSeconds`, `completions`, `parallelism` and `restartPolicy` explicitly. For a single command intended to run once, use one completion, one Pod at a time, `Never` and zero configured retries. Job execution is not an exactly-once guarantee. Make external writes safe to repeat.

Have the workload publish declared files **before it exits** to an approved object prefix or persistent volume with a known reader. For an unproved publication path, use the `remote-container-jobs` batch preflight: the workload identity writes an authorized marker and the caller reads it before submission. Keep outputs distinct by task and attempt. Leave enough time before TTL-based deletion to collect status and logs. A completed Pod can still be listed, but `kubectl cp` needs a running container with `tar`. It is not a batch result store.

## Submit once and follow the controller

Use a reviewed manifest with the assigned run name and ownership marker. A server dry run checks admission without starting Pods. Inspect its result before issuing the create. Capture `metadata.name` and `metadata.uid` from the real create response. If that response is lost, look up the exact name and verify ownership. Absence after a disconnect does not prove a TTL-managed Job never ran.

```text
kubectl --context CONTEXT -n NAMESPACE create --dry-run=server -f JOB_FILE
kubectl --context CONTEXT -n NAMESPACE create -f JOB_FILE -o json
kubectl --context CONTEXT -n NAMESPACE get job JOB -o yaml
kubectl --context CONTEXT -n NAMESPACE get pods -l batch.kubernetes.io/controller-uid=JOB_UID
```

Observe the same UID on a bounded watch or refresh. Stop on either terminal condition: `Complete=True` or `Failed=True`. An interrupted watch or client deadline is not a failed Job. Re-read the Job and its conditions. A success-only `kubectl wait` can otherwise report a timeout long after a Job failed.

For each owned Pod, inspect `status.containerStatuses` for the workload container. A terminated attempt has an exit code and reason. A Pending Pod that never started does not. Use `kubectl --context CONTEXT -n NAMESPACE describe pod POD` for scheduling or image-pull failures. `kubectl --context CONTEXT -n NAMESPACE logs POD -c CONTAINER` reads the current instance. After a restart, match `restartCount` and `lastState.terminated` to `--previous` for the immediately preceding instance. Older logs need a retained source. An evicted Pod can be replaced. Neither a failed attempt nor one successful Pod decides a multi-Pod Job's outcome.

Return the Job UID, terminal condition and reason, relevant attempt evidence and verified output locations. Missing required outputs remain a delivery failure even if the controller reports `Complete`. For authorized teardown, send the recorded Job UID in `DeleteOptions.preconditions.uid` on the delete request. A separate UID read followed by deletion by name can remove a replacement. If the client cannot enforce the precondition, skip manual deletion and report retention or configured TTL. Preserve the namespace, shared claims, service account and cluster.

[Job controller, retries and terminal conditions](https://kubernetes.io/docs/concepts/workloads/controllers/job/) | [kubectl cp requirements](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_cp/)
