---
name: docker-remote-run
description: Run a finite container workload on a remote machine using a named Docker context over SSH or authenticated TLS. Use when offloading to an existing Docker Engine, staging local inputs or recovering files from a stopped container. Not for local builds, Kubernetes or managed cloud jobs.
---

# Run a batch container on a remote Docker Engine

Use the remote daemon for compute and the local CLI for control. You do not need a file server or an inbound port on the container: the Docker connection can transfer files even after the process exits.

## Bind the machine and input

Confirm the approved context, expected host, image digest, command, input files and required outputs. Inspect the endpoint with `docker context inspect CONTEXT`, then check the server with `docker --context CONTEXT info`. Stop on a local or unexpected endpoint, host-key mismatch, or authentication failure. Do not switch the default context, expose the daemon, or provision a VM to make the command work.

Use a reviewed image available to that engine, or use an authorized remote build with a minimal build context. A bind mount resolves on the **daemon host**: `-v` with a laptop path can silently create an empty directory on the VM. For local inputs, create a stopped container and copy the declared files into an existing directory inside it. Do not send an entire checkout or environment file when the command only needs one input.

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

Retrieve required files into a run-specific local destination. Verify they can be opened and meet the caller's contract. On failure, recover available diagnostics without turning missing files into success. Don't use `--rm`: it can remove the filesystem before `cp`. After recovery, remove only the owned container by ID and any explicitly run-owned resources. If recovery is blocked, state what remains, its location and the applicable retention or teardown decision. Never prune the engine or remove the shared host.

[Remote engine access](https://docs.docker.com/engine/security/protect-access/) | [Bind mounts](https://docs.docker.com/engine/storage/bind-mounts/) | [Wait](https://docs.docker.com/reference/cli/docker/container/wait/) | [Copy](https://docs.docker.com/reference/cli/docker/container/cp/)
