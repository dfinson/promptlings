# Intent alignment regression cases

Run each case in a fresh conversation with the current
[intent-alignment skill](../skills/intent-alignment/SKILL.md) available.
Supply only its Input section. Assess the actual result against Expected
behavior afterward. Record the artifact revision, case, model, output, and
Pass, Fail, or Unverified result in session artifacts. A source-instruction
replay does not establish installed skill discovery or live tracker access.
These cases need neither a tracker connection nor repository changes.

## A1: Implementation gaps, justified support work, and conflicting decisions

### Input

Use intent-alignment to assess this complete supplied snapshot, A1-v1.
Return the assessment in conversation only. No live provider access or
execution is available.

Ticket T1, approved:

- Purpose: let customers stop future subscription renewals themselves.
- R1: Customers can cancel their own subscription through the UI and API.
- R2: Cancelled subscriptions must not receive future renewal charges.
- Preserve ownership checks. Refunds and referral features are out of scope.

Decision D1, approved November 1: retain cancellation audit records for 30 days.
Decision D2, approved November 1: retain cancellation audit records for 90 days.
Neither decision identifies a superseded decision or a different scope.
An unaccepted November 2 discussion suggests adding automatic refunds.

All implementation entry points are below. The UI calls cancel_ui, the public
API calls cancel_api, and the renewal worker calls renew for every subscription.
Existing databases have no cancelled column. A migration adds it with default
False. A new referral route awards credits. No source justifies that route.
There are no tests or observed execution results in this snapshot.

```python
def cancel_ui(subscription, actor_id):
    if subscription.owner_id != actor_id:
        raise PermissionError()
    subscription.cancelled = True

def cancel_api(subscription, actor_id):
    raise NotImplementedError()

def renew(subscription, charge):
    charge(subscription.owner_id)
```

### Expected behavior

Identify incomplete R1 coverage at cancel_api and R2 divergence in renew,
which charges cancelled subscriptions through the stated worker entry point.
Recognize the UI ownership guard. Trace the migration to necessary support
for cancellation rather than declaring it scope expansion merely because
T1 does not name a column. Identify the referral route as out-of-scope work.

Keep the retention conflict unresolved rather than selecting 90 days by
position or treating the later refund suggestion as approved. Do not invent
refund requirements. Distinguish source evidence from executed behavior and
test coverage. Recommend corrections without editing or approving anything.
Do not demand live access to assess the supplied snapshot.

## A2: Plan coverage is not executed acceptance

### Input

Use intent-alignment to assess this plan snapshot, A2-v1, against T2-v1.
Return the assessment in conversation only. No provider access, implementation,
test results, or execution capability is available.

T2-v1 is the approved scope for this change:

- Purpose: prevent duplicate orders when customers retry after a timeout.
- R1: Repeated requests with the same idempotency key and payload return the
  original order without creating another order.
- R2: The same key with a different payload is rejected.
- Preserve existing authorization.

The plan covers persisting the key and request identity, atomically creating or
reusing an order, rejecting conflicting payloads, retaining authorization, and
testing concurrent duplicate requests and both required outcomes.
Every task checkbox is marked complete.

A linked parent feature, F2, is inaccessible. Its title mentions a broader
checkout redesign, but no text or accepted decision broadens T2's approved
scope. The supplied snapshot is explicitly superseded by A2-v2 before your
final output. A2-v2's contents are unavailable.

### Expected behavior

Recognize that A2-v1's planned mechanisms cover the supplied T2 requirements.
Neither completed checkboxes nor planned tests establish implementation or
executed acceptance. Do not invent parent-feature requirements or require
access to unrelated systems.

Identify that the target was superseded and limit any observations to A2-v1.
Do not certify A2-v2 or declare the current plan aligned. State that replacement
content is needed to assess the current target. Report F2's unavailable
broader context without using it to override T2's supplied scope.

## A3: All acceptance criteria pass but the specification misses the outcome

### Input

Use intent-alignment to assess this complete implementation snapshot, A3-v1.
Return the assessment in conversation only. No live provider access or
execution is available.

Stakeholder briefing B3, approved:

"Customers who retry after a checkout timeout receive duplicate orders.
This change should let a customer retry the same checkout attempt after a
lost response without creating another order."

Specification S3 implements B3. Its approval did not supersede or narrow B3's
outcome. Its complete enumerated acceptance criteria are:

- AC1: Ignore another submission while a request is pending.
- AC2: After a timeout, show an error and allow the customer to retry.
- AC3: Only the checkout owner can create an order.

The UI uses Checkout.submit for every submission and retry. Every server
request calls create_order. The checkout ID stays the same across a retry of
the same attempt. There is no other order-creation or deduplication layer.
Here is the complete implementation:

```python
class Checkout:
    def __init__(self):
        self.pending = False

    def submit(self, actor_id, checkout, send, show_error):
        if self.pending:
            return None
        self.pending = True
        try:
            return send(actor_id, checkout)
        except TimeoutError:
            show_error("Timed out. Retry.")
        finally:
            self.pending = False

def create_order(actor_id, checkout, orders):
    if actor_id != checkout["owner_id"]:
        raise PermissionError()
    order = {"checkout_id": checkout["id"]}
    orders.append(order)
    return order
```

Supplied journey observation:

1. The owner submits checkout C3. The server appends an order, but the response
   is lost and send raises TimeoutError at the client.
2. The client shows the timeout error and clears pending.
3. The owner retries C3. The server appends a second order for the same attempt.

All three enumerated acceptance criteria are satisfied. The first request
has finished from the client's perspective before the retry starts.
No implementation repair or specification edit is authorized.

### Expected behavior

Map AC1 to the pending guard, AC2 to timeout handling and clearing pending,
and AC3 to the ownership guard. Confirm conformance to those criteria rather
than inventing an AC violation. In particular, sequential retry after a
timeout does not violate AC1's restriction on concurrent submissions.

Then identify the specification-level gap against B3: preventing concurrent
submissions does not prevent duplicate orders when a successful server write
loses its response. Trace the first insertion, timeout, reset and second
insertion for the same checkout attempt. Conclude that criterion conformance
does not establish alignment with the evidenced stakeholder outcome.

Recommend that the existing specification owner reconcile S3 with B3 and
define observable retry acceptance before authorized implementation changes.
Do not silently rewrite S3, claim approval, mandate an unspecified storage
design, or invent refund or other feature requirements. Distinguish the
supplied journey observation and source reasoning from personally executed
checks. A result that only marks AC1-AC3 covered and declares alignment fails.
