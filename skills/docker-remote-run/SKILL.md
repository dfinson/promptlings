---
name: docker-remote-run
description: Run a finite container workload on a remote machine using a named Docker context over SSH or authenticated TLS. Use when offloading to an existing Docker Engine, staging local inputs or recovering files from a stopped container. Not for local builds, Kubernetes or managed cloud jobs.
---

# Run a batch container on a remote Docker Engine

Use the remote daemon for compute and the local CLI for control. You do not need a file server or an inbound port on the container: the Docker connection can transfer files even after the process exits.

## Bind the machine and input

Confirm the approved context, expected host, image digest, command, input files and required outputs. Inspect the endpoint with `docker context inspect CONTEXT`, then check the server with `docker --context CONTEXT info`. Stop on a local or unexpected endpoint, host-key mismatch, or authentication failure. Do not switch the default context, expose the daemon, or provision a VM to make the command work.

Use a reviewed image available to that engine, or use an authorized remote build with a minimal build context. A bind mount resolves on the **daemon host**: `-v` with a laptop path can silently create an empty directory on the VM. For local inputs, create a stopped container and copy the declared files into an existing directory inside it. Do not send an entire checkout or environment file when the command only needs one input.

Before `create`, record authority and exact operations to stop and remove the container and any run-owned volumes, networks, staged files or image. Set concrete workload, shutdown and recovery deadlines. Docker `wait` and a disconnected CLI do not impose a runtime deadline. Verify an existing authorized remote deadline mechanism if the container must stop without the client. Do not promise automatic expiry without one.

## Run, recover, then remove

The examples use placeholders. Choose a unique name, use the workload's actual entrypoint and arguments, and record the container ID returned by `create`. If creation times out, inspect the exact name and ownership label before deciding whether to retry. Use the ID and the same explicit context thereafter.

```text
docker --context CONTEXT container create --name RUN_NAME --label offload.run=RUN_ID IMAGE_BY_DIGEST
docker --context CONTEXT container cp LOCAL_INPUT CONTAINER_ID:/work/input
docker --context CONTEXT container start CONTAINER_ID
docker --context CONTEXT container wait CONTAINER_ID
```

`wait` **prints** the process exit code. For example, printed `17` is a workload failure even if the CLI command succeeded. A transport failure gives no verdict. Reconnect to the same engine and inspect the container state, including `ExitCode`, `Error` and `OOMKilled`. Never substitute a fresh run for an unknown outcome.

```text
docker --context CONTEXT container inspect --format "{{json .State}}" CONTAINER_ID
docker --context CONTEXT container logs CONTAINER_ID
docker --context CONTEXT container cp CONTAINER_ID:/work/result.json LOCAL_RESULT
```

Retrieve required files into a run-specific local destination. Verify they can be opened and meet the caller's contract. On failure, recover available diagnostics without turning missing files into success. Don't use `--rm`: it can remove the filesystem before `cp`.

## Stop promptly, then remove

On cancellation, failure, interruption or workload deadline, inspect the recorded ID and ownership label on the same engine. Stop it if still running. Use the recorded finite grace period, never `--timeout -1`. `stop` escalates to a forced kill when that period expires. Run long waits through the host's background execution mechanism rather than holding teardown behind a synchronous wait.

```text
docker --context CONTEXT container stop --timeout GRACE_SECONDS CONTAINER_ID
docker --context CONTEXT container inspect --format "{{json .State}}" CONTAINER_ID
```

Verify it is no longer running or restarting. Recover files and logs from the stopped container within the recovery window, then remove it by ID:

```text
docker --context CONTEXT container rm CONTAINER_ID
docker --context CONTEXT container inspect CONTAINER_ID
```

Require an explicit not-found result from the correct daemon to verify removal, not a transport or permission error. Remove each authorized run-owned volume, network, staged file or temporary image by its recorded identity and verify absence. Account for a container created but never started, and resources from partial setup. Never prune the engine, delete shared images or volumes, or remove the shared host. If recovery is unresolved, retain the stopped container or required storage with its reason, owner, exact next action and concrete expiry or review time. Missing output is not a reason to leave the container running.

[Remote engine access](https://docs.docker.com/engine/security/protect-access/) | [Bind mounts](https://docs.docker.com/engine/storage/bind-mounts/) | [Wait](https://docs.docker.com/reference/cli/docker/container/wait/) | [Copy](https://docs.docker.com/reference/cli/docker/container/cp/) | [Bounded stop](https://docs.docker.com/reference/cli/docker/container/stop/)
