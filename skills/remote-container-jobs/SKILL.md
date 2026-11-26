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

Give each run its own input and output locations and ownership marker. Keep a non-secret record outside the checkout: target context (including region or namespace where applicable), run key, expected outputs and the handle returned at launch. Submit once. One CLI call is not an exactly-once guarantee: account for transport retries, controller retries and redelivery before launching work with non-repeatable side effects. If the client disconnects, reconnect to the recorded handle. If the launch response was lost, reconcile using independent evidence for that run. Never claim the latest execution of a shared definition, resubmit an uncertain launch, or tear down an unidentified run.

## Drive a service or collect a batch result

**Service:** Use the target's service primitive and the application's own setup. Establish an authorized path from the local driver, such as a private tunnel or an existing endpoint. Do not open public ingress by default. Wait for application readiness and exercise it from the actual driver before reporting it reachable. Drive the service and collect the declared outputs while it is available.

**Batch:** Choose the return path before launch. Prefer a run-specific object-store location for files a worker must publish before exit. An OCI artifact is an alternative when the workload can push and the caller can pull. For an unproved push path, verify both identities with an authorized marker round trip first. An image pull proves neither operation. Direct retrieval is enough when the runtime retains a readable result, such as a stopped Docker container. A completed Kubernetes Pod alone is not enough. Follow the captured execution through retries and correlate outputs with the expected attempt or task.

Report the platform outcome, the workload's exit evidence when exposed, each required output actually retrieved and verified, and any available diagnostics. A successful build with a missing `report.json` is incomplete delivery. An absent exit code is unknown, not zero.

## Define teardown before launch and execute it promptly

Before creating resources or submitting work, record the teardown contract with the run: every owned resource and its exact identity, authority to stop and remove it, the stop or cancel operation, workload deadline including retries, shutdown grace period, bounded result-recovery window, and disposition of temporary inputs, images and outputs. Distinguish run-owned resources from shared or deliberately durable infrastructure. Choose concrete durations for this workload, not an indefinite wait. Check the platform's timeout or an existing authorized expiry mechanism so loss of the local client does not leave work running indefinitely. A client observation deadline alone does not stop remote compute.

Begin teardown in the same workflow as soon as the service is no longer needed, the batch is terminal, the caller cancels, or the workload deadline is reached. Handle failure and interruption through the same teardown path, including partial setup before submission. Stop unnecessary compute and close run-owned tunnels promptly. Preserve volatile results before stopping only within the recorded recovery window, unless the caller requires immediate cancellation. Recover durable outputs after stopping. Do not keep compute running merely because an output is missing.

Recheck target, identity and ownership before each destructive operation. Cancel or stop the specific run, verify it is terminal with no active owned workers or retries, then recover results and remove authorized temporary resources without deleting their only required copy. Use the companion's native operations. If setup created durable infrastructure, remove it only when the approved plan makes it temporary and run-exclusive, using the same infrastructure owner and reviewed destroy scope. Leave shared definitions, infrastructure, other executions and their artifacts alone.

Do not defer teardown to a future conversation or treat a successful stop request as proof of shutdown. Reconcile an uncertain response against the recorded handle before retrying. If access, identity or result recovery remains unresolved, continue teardown of independently identified resources. Retain only what recovery needs, preferably stopped compute or durable storage rather than a live service. For each retained resource, report its handle, observed state, reason, ongoing cost exposure, exact next action, responsible owner and concrete expiry or next review time. Report stop and removal evidence separately from retained results. Teardown is complete only when every owned resource is verified removed or has an explicit retention disposition.
