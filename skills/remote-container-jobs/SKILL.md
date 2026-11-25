---
name: remote-container-jobs
description: Offload a build, test, render or live service from the local machine to remote compute and bring back its results. Use to choose a target, adopt or create its durable base, drive a service remotely, or recover a batch run after disconnect. For a known batch target, use its matching runtime skill.
---

# Offload work and recover its results

Start with what the caller needs back. A live browser test needs a service the local driver can reach. A build that writes a report needs no inbound connection, but the report must survive the build process. Keep the heavy work, including any image build, off the caller's machine.

## Choose and prepare the target

Prefer the user's designated target. Verify the account and endpoint, permission to send the specific source and data there, and authority to run the workload. An installed CLI or an accessible account is not approval. If several suitable targets remain and none has been selected, resolve the choice before submission.

For a finite command, load only the matching companion through the host's skill mechanism:

| Existing target | Skill |
| --- | --- |
| Machine with a remote Docker Engine | `docker-remote-run` |
| Kubernetes cluster | `kubectl-batch-job` |
| Azure Container Apps Job | `azure-container-apps-job` |
| AWS Batch queue, standalone ECS task or compatible Lambda function | `aws-batch-execution` |
| Google Cloud Run Job | `gcloud-run-job` |

Lambda needs a compatible event handler, not an arbitrary container command. For another target, establish from its native documentation how to submit, identify, observe and recover the run. If a necessary capability or companion is missing, name it rather than silently running locally.

Identify what will execute the work, how it reads the input and how the caller retrieves the output. These do not require three new resources. An existing Docker host may supply all three. When durable resources are missing:

1. Use the user's Terraform or OpenTofu project, provider versions and approved backend. Keep protected state outside the checkout. Reference infrastructure owned elsewhere. Import an existing resource only with authority to manage it.
2. Plan the missing compute base, image registry or result store as needed. Protect managed shared resources against destruction. Inspect the plan for the correct account, replacements and deletions. Reject a plan that destroys or replaces shared infrastructure. Apply only the reviewed plan with authorization, then check that an unchanged second plan proposes no changes.
3. If neither tool is available, use a provider-native setup only with the same explicit scope, ownership checks and approval. Keep transient executions out of durable state. Do not create a new scheduler or provision a base when the existing one suffices.

## Bind one run

For a build, record both the source revision and the identity of the image produced. For an existing image or function, pin its digest or published version instead of rebuilding. Record the entrypoint, arguments, required outputs and destination. Stage only authorized inputs and check any seed against the workload version. Supply credentials through platform secret references or workload identity, never in images, logs or result bundles. Choose resources and timeout for the workload and platform quotas. Promptlings sets no cap on builds, runs or concurrency. Distinguish measured time from estimated cost, including standing resources.

Give each run its own input and output locations and ownership marker. Keep a non-secret record outside the checkout: target context (including region or namespace where applicable), run key, expected outputs and the handle returned at launch. Submit once. If the client disconnects, reconnect to that handle. If the launch response was lost, reconcile using independent evidence for that run. Never claim the latest execution of a shared definition, resubmit an uncertain launch, or tear down an unidentified run.

## Drive a service or collect a batch result

**Service:** Use the target's service primitive and the application's own setup. Establish an authorized path from the local driver, such as a private tunnel or an existing endpoint. Do not open public ingress by default. Wait for application readiness and exercise it from the actual driver before reporting it reachable. Drive the service and collect the declared outputs while it is available.

**Batch:** Choose the return path before launch. Prefer a run-specific object-store location for files a worker must publish before exit. An OCI artifact is an alternative when the workload can push and the caller can pull. For an unproved push path, verify both identities with an authorized marker round trip first. An image pull proves neither operation. Direct retrieval is enough when the runtime retains a readable result, such as a stopped Docker container. A completed Kubernetes Pod alone is not enough. Follow the captured execution through retries and correlate outputs with the expected attempt or task.

Report the platform outcome, the workload's exit evidence when exposed, each required output actually retrieved and verified, and any available diagnostics. A successful build with a missing `report.json` is incomplete delivery. An absent exit code is unknown, not zero.

On success, failure or interruption, account for every run-owned resource. Recover results before removing their only copy. Verify ownership and identity again before authorized teardown. If recovery is blocked or state is unknown, retain what is needed and give the caller the handle, remaining resources and next recovery step. Leave shared definitions, infrastructure, other executions and their artifacts alone.
