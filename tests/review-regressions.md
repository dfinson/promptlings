# Review regression cases

Three adjudicated cases exercise the distinction between a defect, a chosen tradeoff, and a plausible false positive. Use them when materially changing a review agent, including Sparring Partner. They require no evaluation service or HVE installation.

## Running and assessing the cases

Run each case in a fresh conversation with the agent being changed. Supply only the text under that case's Input heading, including its purpose, context, and diff. Keep the Expected behavior section out of the agent's input so it cannot copy the answer.

Ask for the agent's normal narrative and applicable appendices. The input is a closed, supplied-patch fixture, not a live PR. Repository and provider checks are unavailable, external posting is out of scope, and any domain research must use the supplied technical subject without uploading repository content.

For Sparring Partner, request its normal PR and change-review result instead of Nitcracker's or Walkthrough's narrative and appendices. Make its four companion methods available in the fresh context. It must load and apply all four, scale the design stage to the fixture, and return findings, substantive reasoning, and method and evidence coverage in conversation. It must not invoke rubber-duck, spawn an ensemble, write reports, or require live PR access for these supplied snapshots. Distinguish loading a method from applying it to the fixture.

After the run, compare the actual output with Expected behavior. Record the agent revision, selected model, case ID, outcome (Pass, Fail, or Unverified), and supporting output in session artifacts. A case passes only when every stated expectation is met. Missing output is Unverified. Check both canonical agents when changing shared review rules, and check a host-specific copy when changing its adaptation. These cases are a small maintenance check, not proof of general review accuracy.

For snapshot-rule changes, also replay an existing case with the supplied snapshot explicitly superseded before final output. The agent must label its draft stale and stop until it has reviewed the new snapshot. A failed or unavailable freshness read must block external posting, not count as an unchanged target.

## R1: A changed authorization rule introduces a defect

### Input

Review this supplied patch and complete source context. The contract is that an owner or an administrator can delete a document. Other actors cannot. IDs are non-empty strings and `is_admin` is a boolean. This is the complete authorization function, with no external middleware granting access.

Snapshot: R1-v1, file `permissions.py`. No checkout, PR, or live CI is available. Produce a local draft only.

```diff
diff --git a/permissions.py b/permissions.py
--- a/permissions.py
+++ b/permissions.py
@@ -1,2 +1,2 @@
 def can_delete(actor_id, owner_id, is_admin):
-    return actor_id == owner_id or is_admin
+    return actor_id == owner_id and is_admin
```

### Expected behavior

Nitcracker reports one defect anchored to added line 2. A non-admin owner (`"alice", "alice", False`) is denied, and a non-owner admin (`"bob", "alice", True`) is also denied. The required correction restores the contract's alternative paths, rather than asking the reviewer to choose an access policy.

Walkthrough explains the new intersection of ownership and administrator status with a quote of the changed line. It can briefly identify the contract mismatch and recommend functional review, as its scope permits. It does not produce inline findings, severity ratings, or a fix proposal.

Both agents produce the narrative, keep the supplied snapshot/local-draft limitation visible, and do not reclassify the demonstrated defect as an open design fork or an implicit bet.

Sparring Partner demonstrates both denied authorized paths, identifies the contract violation at added line 2, recommends restoring the alternative paths, and explains a regression assertion that would catch the defect. It does not invent an unresolved access-policy decision.

## R2: A cache makes a legitimate, explicit tradeoff

### Input

Review this supplied patch and complete source context. This reader serves a non-critical status dashboard. `now` is monotonic time in seconds and never decreases. `fetch` returns a status string or raises an error. The dashboard permits values less than 60 seconds old. No workload, upstream call budget, or preferred refresh interval has been specified.

Snapshot: R2-v1, file `status.py`. No checkout, PR, or live CI is available. Produce a local draft only.

```diff
diff --git a/status.py b/status.py
--- a/status.py
+++ b/status.py
@@ -1,3 +1,12 @@
 class StatusReader:
+    def __init__(self):
+        self._value = None
+        self._at = None
+
     def read(self, now, fetch):
-        return fetch()
+        if self._at is not None and now - self._at < 30:
+            return self._value
+        value = fetch()
+        self._value = value
+        self._at = now
+        return value
```

### Expected behavior

Both agents explain and quote the chosen 30-second cache window as an implicit bet. They state the mechanical tradeoff: callers within the window reuse a value and avoid upstream calls, while a shorter window or fetching every time reduces staleness at the cost of more upstream work. They ask which refresh/load balance the reviewer wants, without deciding it.

Neither agent reports caching itself as a defect, invents a real-time requirement, or presents the already-selected 30-second policy as an unresolved design fork. The narrative and implicit-bet appendix remain present. Live provider checks remain unavailable and no external posting occurs.

Sparring Partner explains the freshness/load tradeoff and the explicit 60-second allowance without declaring the 30-second choice defective. Its test analysis addresses reuse before the cache boundary and refresh at the boundary, distinguishing proposed assertions from executed checks. It need not ask a policy question when the supplied requirement already establishes acceptability.

## R3: Reachability disproves a convincing false positive

### Input

Review this supplied patch and complete source context. `values` is an ordinary Python list of numbers. Empty input must return `None`, and non-empty input must return its arithmetic mean. `_mean` is private and its only caller is `summarize`. Explain the behavior for `summarize([])` and `summarize([2, 4])`.

Snapshot: R3-v1, file `summary.py`. No checkout, PR, or live CI is available. Produce a local draft only.

```diff
diff --git a/summary.py b/summary.py
--- a/summary.py
+++ b/summary.py
@@ -1,4 +1,6 @@
 def _mean(values):
     return sum(values) / len(values)
 def summarize(values):
+    if not values:
+        return None
     return _mean(values)
```

### Expected behavior

Both agents trace the new empty-list guard before discussing the division. `summarize([])` returns `None`, and `summarize([2, 4])` returns `3.0`. No division-by-zero finding survives because empty input cannot reach `_mean` through the only caller.

The narrative explains the guard with quoted changed code. No design fork or implicit bet is required by this case. Nitcracker can finish with an empty finding set, and Walkthrough remains orientation-only. Neither pads the result with a hypothetical caller or an unrelated change request. Live provider checks remain unavailable and no external posting occurs.

Sparring Partner rejects the division-by-zero candidate using the only caller's guard, explains both specified results, and distinguishes inspected behavior from executed checks. It does not invent a design concern or a missing caller to fill its design stage.

## Sparring Partner and ensemble contract probes

Alongside R1-R3, check these boundaries when changing Sparring Partner or the ensemble:

- With a required method unavailable, standalone Sparring Partner identifies that method and reports partial method coverage. It can return supported findings without claiming the full flow ran.
- With a required Sparring Partner method unavailable before dispatch, the ensemble reports Blocked and does not silently substitute rubber-duck.
- With the supplied snapshot superseded before final output, Sparring Partner identifies stale conclusions and stops for replacement evidence rather than certifying the replacement.
- An unqualified ensemble request selects the-nitcracker, PR Walkthrough, and Sparring Partner. An explicitly requested historical rubber-duck roster remains a different caller-selected composition.
- The ensemble supplies Sparring Partner the same factual target and requirements as its peers and requests its four-method review flow without another worker's conclusions. The invoking agent still performs its own evidence verification and synthesis afterward.
- Both installers' review selections include all three default agents and publish all four Sparring Partner companion methods. Explicit agent selections remain caller-controlled.
- An alignment request or material cross-source scope uncertainty also selects `intent-alignment`. Ordinary reviews retain the four required methods without forcing a separate alignment report. An unavailable alignment method is disclosed rather than claimed as applied.
