# The PR that fixed "assistantassistantassistantassistantassistantassistant"

*How a 21-month-old bug about a repeated JSON field turned into a chunk-for-chunk rewrite of Ollama's OpenAI streaming wire format, and why 127 lines of source needed 719 lines of test.*

## Twenty-one months of assistantassistantassistant

Issue #7626 was filed on 2024-11-12. It was closed on 2026-08-03, by this PR. The bug was that Ollama put `"role":"assistant"` in every streaming chunk instead of only the first. That sounds like a cosmetic nit until you read what the reporter actually got back from `client.beta.chat.completions.stream`, which accumulates deltas field-by-field the way the SDK assumes a well-behaved server intends:

```json
"role": "assistantassistantassistantassistantassistantassistant"
```

Six chunks, six roles, one string concatenation, and a completion object that claims to have been written by an entity named assistantassistantassistantassistantassistantassistant. This is Hyrum's Law with the serial numbers filed off: *"with a sufficient number of users of an API, it does not matter what you promise in the contract: all observable behaviors of your system will be depended on by somebody."* Nobody at OpenAI documented "role appears exactly once." The SDK just encoded the observation, and Ollama's job became matching an implementation, not a spec.

Which is exactly how this PR was built. From the description: "based on captures I took of real OpenAI traffic." Not from the OpenAI spec. From tcpdump-grade empiricism against a live vendor endpoint. Hold that thought, because it explains most of the judgment calls in the diff.

Four files. 846 insertions, 103 deletions. 127 lines of that is source; the other 719 is test. CI is green on all three platforms (`test (ubuntu-latest)` 1m19s, `test (macos-latest)` 2m31s, `test (windows-latest)` 3m57s), plus `changes`, `go_mod_tidy`, and both `patches` jobs. The `linux` and `windows` build jobs and the Mintlify deploy are skipped. drifkin reviewed it across three rounds and approved. Six commits, and the last two exist entirely because of review comments, which is the most interesting thing about the history and where we'll spend the most time.

## Two structs and a lie about what a delta is

The load-bearing change is four lines long. Before this PR, a streaming chunk's `delta` was a `Message`:

```go
type ChunkChoice struct {
	Index        int             `json:"index"`
	Delta        Message         `json:"delta"`
	FinishReason *string         `json:"finish_reason"`
	Logprobs     *ChoiceLogprobs `json:"logprobs,omitempty"`
}
```

`Message` (`openai/openai.go:33-40`) is the request-side type. It carries `Name` and `ToolCallID`, which no streaming delta has ever contained, and critically its `Role` and `Content` have no `omitempty`:

```go
type Message struct {
	Role       string     `json:"role"`
	Content    any        `json:"content"`
	Reasoning  string     `json:"reasoning,omitempty"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	Name       string     `json:"name,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
}
```

That is the whole bug. `Role` without `omitempty` means every chunk that runs through this struct emits `"role":"assistant"`, forever, no matter what the caller wants. The 2024 issue was not a logic error; it was a struct tag. Twenty-one months of `assistantassistantassistant` traceable to two missing words.

The PR's answer is a new response-only type at `openai/openai.go:42-49`:

```go
// Delta is used in streaming chunk responses. All fields use omitempty so
// that a finish chunk produces a truly empty delta `{}` matching the OpenAI spec.
type Delta struct {
	Role      string     `json:"role,omitempty"`
	Content   any        `json:"content,omitempty"`
	Reasoning string     `json:"reasoning,omitempty"`
	ToolCalls []ToolCall `json:"tool_calls,omitempty"`
}
```

`ChunkChoice.Delta` is retyped to it at `openai/openai.go:64`. Two fields dropped, four tags added, and now the delta can express "I have nothing to say," which turns out to be a thing OpenAI's wire format needs it to say quite often.

The `Content any` field is where the diff gets subtle, and the author knew it, because there are two separate comments in the diff explaining the same encoding rule. First at line 42-43 above, and again at `openai/openai.go:315-318` inside `toChunk`:

```go
	// Content is typed as any with omitempty: nil is omitted, "" is kept.
	// Use the string value from the response so empty-string content (e.g. first
	// chunk or reasoning-only) is explicitly serialized as "content":"".
	var content any = r.Message.Content
```

The rule being leaned on: under `encoding/json`, `omitempty` on an interface-typed field omits only when the interface itself is nil. An interface holding an empty string is not empty, so `"content":""` survives. That is the entire mechanism by which OpenAI's opening frame `{"role":"assistant","content":""}` is reproducible, and it is also the entire mechanism by which the finish chunk's `{}` is reproducible, because `FinishChunk` builds a `Delta{}` whose `Content` interface is genuinely nil.

Two behaviors that must differ, distinguished by a distinction most Go programmers cannot state from memory, expressed through a field typed `any` because the *request* type needed `any` to accept OpenAI's content-parts arrays. That's a judgment call, not a bug, and it's in the appendix as a bet. The tests hold it down hard: `openai/openai_test.go:921-958` (`TestToStreamChunks_EmptyContentChunkJSON`) marshals a chunk, unmarshals it into `map[string]any`, and at lines `945-947` asserts the *key* is present:

```go
	content, hasContent := delta["content"]
	if !hasContent {
		t.Fatalf("expected content key to be present for empty-string content, got %v", delta)
	}
```

That test is not testing Ollama. It is testing `encoding/json`. When your API's correctness rests on a serialization rule, the rule is part of your contract, and this pins it so CI screams if it ever moves.

## The chunk that stopped carrying its own ending

Pre-PR, `toChunk` computed the finish reason inline, on every chunk, using a closure:

```go
			FinishReason: func(reason string) *string {
				if len(reason) > 0 {
					if toolCallSent || len(toolCalls) > 0 {
						return &finishReasonToolCalls
					}
					return &reason
				}
				return nil
			}(r.DoneReason),
```

That closure is gone. `toChunk` at `openai/openai.go:334-338` now builds a choice with no `FinishReason` field at all:

```go
		Choices: []ChunkChoice{{
			Index:    0,
			Delta:    Delta{Role: role, Content: content, ToolCalls: toolCalls, Reasoning: r.Message.Thinking},
			Logprobs: logprobs,
		}},
```

Nil pointer, `json:"finish_reason"` with no `omitempty`, so every content chunk emits `"finish_reason":null`. That is what the spec requires: in `CreateChatCompletionStreamResponse`, each element of `choices` has `required: [delta, finish_reason, index]`, with `finish_reason` nullable. Ollama's content chunks are schema-conformant here.

The ending moved into a new function, `openai/openai.go:368-396`:

```go
// FinishChunk creates a dedicated finish-reason chunk with an empty delta,
// matching the OpenAI spec where finish_reason is sent on its own chunk.
func FinishChunk(id string, r api.ChatResponse, toolCallSent bool) ChatCompletionChunk {
	// Only remap known terminal reasons; pass anything else through untouched.
	// tool_calls only overrides stop — an unfinished or unknown done reason
	// must not be relabeled tool_calls.
	reason := cmp.Or(r.DoneReason, "stop")
	if reason == "stop" && toolCallSent {
		reason = "tool_calls"
	}
```

Six lines, and they took three commits and two review rounds to converge. That story is worth telling properly.

## Two commits, one review comment, applied twice

Commit `26480be6` ("openai: fix finish reason ordering") shipped `FinishChunk` in its first form:

```go
	reason := r.DoneReason
	if reason != "length" && toolCallSent {
		reason = "tool_calls"
	}
	if reason == "" {
		reason = "stop"
	}
```

This is a deny-list. Everything that isn't `length` becomes `tool_calls` when tool calls were streamed. It fixes the reported bug (a truncated tool-call response used to be mislabeled `tool_calls` and lose the fact that it hit `max_tokens`) by carving out exactly one exception.

drifkin's review comment, on `openai/openai.go:363`:

> This is a good catch about us confusingly saying `tool_calls` for an unfinished response. Maybe we should be even more cautious here and only modify known cases where we're absolutely confident we want to change them.

followed by the exact replacement code. Commit `6c3b0599` takes it verbatim, including pulling in `cmp` for `cmp.Or`. The deny-list becomes an allow-list: nothing gets relabeled except a literal `stop`.

Then drifkin came back a third time, on `openai/openai.go:287`:

> oops I think we probably want to mirror the allow list approach here too

Because the same deny-list had been applied to the *non-streaming* path in the same first commit. Commit `cb5871d5`, the PR head, is that one-line change:

```diff
-				if len(toolCalls) > 0 && reason != "length" {
+				if reason == "stop" && len(toolCalls) > 0 {
```

Three states for the non-streaming path across this PR's history, which is worth laying out because the domain notes are right that the two paths need comparing:

| | non-streaming (`ToChatCompletion`) | streaming (`FinishChunk` / pre-PR `toChunk`) |
|---|---|---|
| pre-PR `a199313e` | `if len(toolCalls) > 0` → always `tool_calls` | `if toolCallSent \|\| len(toolCalls) > 0` → always `tool_calls` |
| `26480be6` | `if len(toolCalls) > 0 && reason != "length"` | `if reason != "length" && toolCallSent` |
| head `cb5871d5` | `if reason == "stop" && len(toolCalls) > 0` | `if reason == "stop" && toolCallSent` |

The two paths land in the same shape, with one asymmetry that survives: streaming defaults an empty reason to `"stop"` via `cmp.Or`, non-streaming has no default and returns a nil pointer, so an empty done reason produces `"finish_reason":null` on the non-streaming path and `"finish_reason":"stop"` on the streaming one. I chased whether that's reachable. `res.DoneReason = r.DoneReason.String()` at `server/routes.go:2777` is the only assignment on the chat path, and `DoneReason.String()` at `llm/server.go:258-266` returns `""` only in its `default:` arm, which is reachable only from `DoneReasonConnectionClosed` (`llm/server.go:255`). A repo-wide grep finds that constant at its declaration and nowhere else. The `"load"` and `"unload"` reasons at `server/routes.go:2628` and `server/routes.go:2490` both require `len(req.Messages) == 0`, and `ChatMiddleware` rejects that with a 400 at `middleware/openai.go:453` before the handler ever runs. So the asymmetry is between two unreachable branches. Noted, not flagged.

What *is* reachable, and what the allow-list buys, is captured in the table test at `openai/openai_test.go:774-840`. Two of its seven cases exist purely to nail down the new philosophy:

```go
		{
			name:           "unknown_reason_passes_through",
			doneReason:     "unload",
			toolCallSent:   false,
			expectedReason: "unload",
		},
		{
			name:           "unknown_reason_not_relabeled_tool_calls",
			doneReason:     "unload",
			toolCallSent:   true,
			expectedReason: "unload",
		},
```

Here is the judgment call, stated without resolution. The spec's `finish_reason` is a closed enum: `stop`, `length`, `tool_calls`, `content_filter`, `function_call`, nullable. `"unload"` is not in it. The allow-list guarantees that any future `DoneReason` string Ollama invents will appear verbatim on the OpenAI-compatible wire as a `finish_reason`. Two failure modes to weigh: pass-through means a client with strict enum validation gets a schema violation the day someone adds a new done reason to the chat path; clamping unknown reasons to `stop` means the wire stays schema-valid but a real terminal condition is silently reported as a normal completion. The reviewer picks. My reachability check says neither fires today.

There is one thing I did flag, and it's a nit. It's below.

## The trailer that isn't a chunk

The middleware is where the sequencing lives, and `ChatWriter` grew two new fields for it (`middleware/openai.go:27-37`):

```go
type ChatWriter struct {
	stream         bool
	streamOptions  *openai.StreamOptions
	id             string
	toolCallSent   bool
	firstChunkSent bool
	// createdAt pins the shared timestamp for every chunk in the stream,
	// captured from the first response.
	createdAt time.Time
	BaseWriter
}
```

Ollama's internal chat stream ends with a metrics-only response: `Done: true`, a `DoneReason`, populated `Metrics`, and an entirely empty `Message`. Feed that through the old code and you get a final chunk of `delta:{"role":"assistant","content":""}` carrying `finish_reason`, which is precisely the frame the 2024 issue reporter pasted. The new code recognizes it and declines (`middleware/openai.go:98-107`):

```go
		// A Done response with an empty message is the metrics-only trailer.
		// OpenAI goes straight from the last content chunk to the finish chunk,
		// so don't emit an empty content chunk for it. If this is the stream's
		// first response, fall through so a wholly empty completion still opens
		// with a role chunk.
		isEmptyTrailer := chatResponse.Done && w.firstChunkSent &&
			chatResponse.Message.Content == "" &&
			chatResponse.Message.Thinking == "" &&
			len(chatResponse.Message.ToolCalls) == 0 &&
			len(chatResponse.Logprobs) == 0
```

The `w.firstChunkSent` clause in there is doing real work and it is easy to skim past. Without it, a completion that produces nothing at all (single response, `Done: true`, empty message) would emit no chunks whatsoever, just a finish chunk and `[DONE]`. OpenAI still opens with a role frame. `TestChatWriter_StreamEmptyCompletionStillEmitsRoleChunk` (`middleware/openai_test.go:772`) pins it, asserting three frames and then, at `803-805`:

```go
	if !strings.Contains(frames[0], `"role":"assistant"`) || !strings.Contains(frames[0], `"content":""`) {
		t.Fatalf("expected initial role chunk with empty content, got %s", frames[0])
	}
```

So one boolean serves two jobs: "should this chunk carry `role`" and "is this a mid-stream trailer we can drop." They coincide because there is exactly one reason a chunk is ever suppressed. The day a second suppression rule arrives, the two meanings come apart, and the failure mode is silent: `role` stops being emitted rather than the build stopping.

The `len(chatResponse.Logprobs) == 0` term is the youngest line in the check, added in commit `f3c8e812` after drifkin's comment on `middleware/openai.go:103`:

> I think you also want to check whether `r.Logprobs == 0`. There are a few other places in the codebase where we consider a logprobs-only message to be non-empty

He's right, and `server/routes.go:2806` is one of those places:

```go
					if res.Message.Content != "" || res.Message.Thinking != "" || len(res.Message.ToolCalls) > 0 || r.Done || len(res.Logprobs) > 0 {
```

But look at what accepting that comment costs. `middleware/openai_test.go:718` (`TestChatWriter_StreamDoneWithLogprobsNotTreatedAsTrailer`) writes a final response with empty content and one logprob, and at line `761` demands exactly four frames, with the comment above it reading `// content + logprobs chunk + finish + [DONE]`. That second frame carries `delta:{"content":""}` and the logprobs on the choice. The stray empty-content chunk that this PR exists to delete is deliberately reinstated whenever the client asks for logprobs. Dropping logprobs is data loss; emitting them requires a frame whose delta is empty. There is no third option available inside this diff, and the PR picks delivery over shape. Also in the appendix as a bet.

The rest of the writer is the ordering. `middleware/openai.go:109-128` emits content chunks and latches `toolCallSent`; `130-158` emits the finish chunk, then conditionally the usage chunk, then `[DONE]`:

```go
			if w.streamOptions != nil && w.streamOptions.IncludeUsage {
				u := openai.ToUsage(chatResponse)
				finishChunk.Usage = &u
				finishChunk.Choices = []openai.ChunkChoice{}
```

The usage chunk reuses the finish chunk as its envelope: same `id`, same `created`, same `model`, and blanking `Choices` to a non-nil empty slice makes it serialize as `"choices":[]` rather than `null`. The spec agrees the field is required and may be empty: "Can also be empty for the last chunk if you set `stream_options: {"include_usage": true}`." `middleware/openai_test.go:710-712` asserts the literal bytes:

```go
	if !strings.Contains(frames[2], `"choices":[]`) {
		t.Fatalf("expected usage frame with empty choices, got %s", frames[2])
	}
```

One factual note on the surrounding context, which this PR did not change and which I am not asking anyone to change: the OpenAI spec's prose for `include_usage` says "All other chunks will also include a `usage` field, but with a null value," while `ChatCompletionChunk.Usage` is `*Usage` tagged `json:"usage,omitempty"`, so Ollama's non-final chunks omit the key entirely. The schema's `required` list for a stream response is `[choices, created, id, model, object]`, so omitting `usage` is schema-valid; the divergence is against the prose, not the contract. In a PR whose stated goal is "chunk-for-chunk," it is the one visible place where the frames differ from the reference capture and the diff doesn't touch it. Whether that matters is a call about which clients read key presence versus value.

## One timestamp, and the thing that made it necessary

Pre-PR, `toChunk` stamped `Created: time.Now().Unix()` on every chunk. The spec's `created` field says "Each chunk has the same timestamp." Ollama's chunks had as many timestamps as there were tokens, drifting a second at a time through a long generation.

The first fix attempt was partial, and drifkin caught it on `openai/openai.go:322`:

> isn't this where we need to re-use the same timestamp for every chunk? I see below the final chunk re-uses one of the timestamps, but I think the goal is for all of them to use the same timestamp?

The author's reply: "Fixed 👌 this was correct." Commit `adc9ef68` moved the pinning up into the writer, where the state to pin it in actually exists (`middleware/openai.go:88-96`):

```go
		// OpenAI stamps one created value on every chunk in a stream; pin the
		// timestamp from the first response (the server stamps each response).
		if chatResponse.CreatedAt.IsZero() {
			chatResponse.CreatedAt = time.Now().UTC()
		}
		if w.createdAt.IsZero() {
			w.createdAt = chatResponse.CreatedAt
		}
		chatResponse.CreatedAt = w.createdAt
```

Three assignments to do one thing: fill in a missing timestamp, capture the first one, then overwrite the response's own timestamp with the captured one so everything downstream inherits it for free. `toChunk` and `FinishChunk` each keep their own `if r.CreatedAt.IsZero()` fallback (`openai/openai.go:323-326` and `380-383`), which is now unreachable from the middleware because line 90 already guaranteed non-zero, and reachable only for direct library callers. `middleware/openai_test.go:495` (`TestChatWriter_StreamSharesOneTimestamp`) writes three responses stamped 1700000000, 1700000010, and 1700000020, and at lines `547-555` asserts all three JSON frames report `created=1700000000`.

## Why 127 lines of source needed 719 lines of test

The ratio looks absurd until you notice what the tests assert. This is not unit-testing a conversion function. It's pinning a byte stream.

The struct-level assertions cannot catch what this PR is about, and the tests say so out loud (`middleware/openai_test.go:139-142`):

```go
	// Wire-format checks that struct round-tripping cannot catch: the finish
	// chunk serializes an empty delta object with no content key, and the usage
	// chunk carries an explicit empty choices array (not null).
	if !strings.Contains(frames[2], `"delta":{}`) {
```

A `ChatCompletionChunk` unmarshalled from `{"delta":{}}` and one unmarshalled from `{"delta":{"content":""}}` are *not* the same Go value here (`any(nil)` versus `any("")`), which is the point, but a `ChatCompletionChunk` unmarshalled from `{"delta":{"role":""}}` and `{"delta":{}}` are identical, and that difference is exactly what issue #7626 was about. So the tests reach for `strings.Contains` on raw SSE frames and for `map[string]any` key-presence checks. `TestFinishChunk_JSONDeltaEmpty` (`openai/openai_test.go:842`) marshals, unmarshals into a generic map, and at line `860` asserts `len(delta) != 0` is a failure. `TestToStreamChunks_ContentChunkJSON` (`openai/openai_test.go:888`) asserts at line `912` that the `role` key is *absent*, not empty.

The seven new middleware tests are frame-count-plus-content assertions over full streams: role-only-on-first (`414`), shared timestamp (`495`), `length` survives (`558`), `tool_calls` on a done-with-tools response (`602`), metrics trailer suppression (`656`), logprobs trailer non-suppression (`718`), empty completion still opens with role (`772`). Each one asserts an exact frame count first, so an extra or missing chunk fails loudly instead of shifting an index. That is why the ratio is 5.7:1. When your contract is "these exact bytes in this exact order," the test *is* the specification, and 719 lines is what a specification costs.

## What the diff quietly commits to

Three things leave this PR that are hard to walk back.

`ToChunk` is deleted. It was marked `// Deprecated: use ToChunks for streaming conversion.` and a repo-wide grep confirms nothing called it. `ToChunks` is renamed to `ToStreamChunks`, and the reason is on the record. drifkin, on `openai/openai.go:336`:

> since this is exported, changing the meaning of the third param could silently cause bugs in callers that don't know they need to change this param

The third parameter went from `toolCallSent bool` to `includeRole bool`. Same type, inverted-ish meaning, silent miscompile-free breakage for anyone outside the repo. The author's response: "I changed the function name so that it hard breaks at build time. Making the update obvious." That policy, rename-to-break, was applied to one of the three breaks in this PR. The third, `ChunkChoice.Delta` changing type from `Message` to `Delta` at `openai/openai.go:64`, was never discussed. It also hard-breaks at build time, so the outcome matches the policy; it just arrived there without anyone saying so.

And the allow-list. RFC 9413, "Maintaining Robust Protocols," has a section titled "Harmful Consequences of Tolerating the Unexpected" and another called "Virtuous Intolerance." Its argument against the reflexive reading of Postel's law is that tolerance compounds into protocol decay: implementations accrete quiet accommodations until the spec stops describing reality. This PR is the receiving end of exactly that dynamic. `"role":"assistant"` on every chunk was tolerated by every OpenAI client for 21 months except the one that concatenated it, and Ollama had no reason to know until someone's assistant was named assistantassistantassistantassistantassistantassistant. The allow-list is that lesson pointed outward: be strict about what you rewrite, because you cannot know what a future done reason means. What it doesn't do is be strict about what it *sends*, and the enum is closed. Both halves of the robustness principle are in play and the diff picks one.

Meanwhile, `middleware/openai.go:475` still reads `id: fmt.Sprintf("chatcmpl-%d", rand.Intn(999))`. Not this PR's problem, not in this diff, but a wire-format compatibility PR that pins the exact byte-level shape of `"delta":{}` while the completion ID has 999 possible values is a nice illustration of where the fidelity budget went.

---

## Inline findings

**File:** `openai/openai.go` line 374

````markdown
nit: The PR description (now the body of squash commit `8edecb5c`) says "Precedence is `length` > `tool_calls` > the response's done reason > `stop`." That describes the deny-list from `26480be6` (`if reason != "length" && toolCallSent`), not the allow-list that shipped. Under the code here, `tool_calls` never outranks the response's done reason; it only replaces a literal `stop`. The table case `unknown_reason_not_relabeled_tool_calls` at `openai/openai_test.go:817-822` asserts `"unload"` + `toolCallSent` stays `"unload"`, which is the opposite of the documented ordering. No reachable input differs today, since the chat path only produces `stop` and `length`, so this is a description fix, not a code fix.
````

That is the only finding. One nit, and it's about prose.

## Design forks for reviewer judgment

- **Unknown done reasons are passed through as `finish_reason` verbatim** — `openai/openai.go:374-377`, enshrined by the test cases at `openai/openai_test.go:811-822`. The code defaults an empty reason to `stop` and remaps `stop`+`toolCallSent` to `tool_calls`, and forwards everything else untouched. The options: (pass through any `DoneReason` string as-is; clamp anything outside the spec enum to `stop`; clamp to `stop` and surface the real reason in a vendor-prefixed extension field). What differs: the spec's `finish_reason` is a closed enum of `stop`/`length`/`tool_calls`/`content_filter`/`function_call`, nullable, so pass-through means any future done reason that reaches this path is a schema violation for strict clients, while clamping means a genuinely abnormal termination is reported as a normal one with no channel to say otherwise. What would settle it: whether any `DoneReason` other than `stop` or `length` can reach `/v1/chat/completions`. Today none can (`llm/server.go:258-266` yields only `"stop"`, `"length"`, or `""`; `DoneReasonConnectionClosed` at `llm/server.go:255` is never assigned; the `"load"`/`"unload"` producers at `server/routes.go:2628` and `2490` require empty messages, which `middleware/openai.go:453` rejects with a 400). A roadmap answer about whether that stays true is the settling signal.

- **`firstChunkSent` is one flag serving two questions** — `middleware/openai.go:32`, read at `103` and `110`. It answers both "should this chunk carry `role`" and "is this Done response a mid-stream trailer we can drop." The options: (one flag, since the two conditions coincide today; two flags, `roleSent` and `anyChunkEmitted`). What differs: blast radius when a second suppression rule appears. Any future reason to skip emitting a chunk silently changes when `role` is sent, and the failure mode is the 2024 bug's mirror image (role never sent at all) rather than a compile error. What would settle it: whether more chunk-suppression rules are expected. The logprobs carve-out added in `f3c8e812` is already a modification to the suppression predicate rather than a new one, so the pressure is real but hasn't split yet.

## Implicit bets (reviewer should agree or push back)

- **`Delta.Content` is `any` to encode absent-versus-empty** — `openai/openai.go:46`. **What:** a response-only field is typed `any` with `omitempty`, so `nil` omits the key and `""` emits `"content":""`, with the rule spelled out in comments at `42-43` and `315-318`. **Why it's defensible:** `Message.Content` is already `any` (`openai/openai.go:35`) because the request side must accept OpenAI's content-parts arrays, so `Delta` mirrors the sibling type and the round-trip assertions in tests (`content.Delta.Content != "final answer"`) keep working without dereferences. **Alternative cost:** `Content *string` states absent-versus-empty in the type system instead of in a comment, and would have cost a deref in roughly a dozen test assertions plus a `&` at the two construction sites. **The question to answer:** `Delta` is never unmarshalled from client input and never holds a content-parts array, so does mirroring the request type buy anything that offsets encoding a wire-visible distinction through a `encoding/json` interface-emptiness rule?

- **Three source-breaking changes to an exported package, all deliberately loud** — `openai/openai.go:64` (`ChunkChoice.Delta` retyped `Message` → `Delta`), `345` (`ToChunks` → `ToStreamChunks`), and the deletion of `ToChunk` in the hunk at `368`. **What:** the package `github.com/ollama/ollama/openai` loses an exported function, renames another, and changes an exported struct field's type in one release. **Why it's defensible:** all three fail at compile time rather than silently, which is exactly the property drifkin asked for on `openai/openai.go:336` and the author engineered by renaming rather than repurposing the parameter; `ToChunk` was `// Deprecated:` and a repo-wide grep finds no caller. **Alternative cost:** keeping `ToChunk` as a shim and adding `Delta` alongside `Message` would preserve downstream builds at the cost of two dead exports and an ambiguous delta type. **The question to answer:** the rename got an explicit "make it hard-break" decision and the type change didn't; is `openai` a package with out-of-repo Go consumers whose build breakage is a cost worth counting, or is it effectively internal?

- **The role frame rides on the first content chunk, not a chunk of its own** — `middleware/openai.go:110`, verified by `middleware/openai_test.go:414-467`, where a first response carrying `"Hello"` (line 427) produces `frames[0]` whose delta has `role` (line 465) alongside that content. **What:** `includeRole := !w.firstChunkSent` puts `role` on whatever chunk happens to be emitted first. **Why it's defensible:** it closes issue #7626 (role appears exactly once) with no extra frame, and Ollama's stream has no natural pre-token event to hang a role-only chunk on. **Alternative cost:** synthesizing a dedicated `{"role":"assistant","content":""}` frame before the first token adds one frame per stream and a synthetic emission with no upstream response behind it. **The question to answer:** both reference captures in this PR's own material (the description's OpenAI block, and the issue #7626 capture where chunk 1 is `{"delta":{"content":"","role":"assistant"}}` and chunk 2 is `{"delta":{"content":"The"}}`) show OpenAI sending role on a contentless frame ahead of the first token; I could not identify a client that breaks on the merged form, so the reviewer should decide whether "chunk-for-chunk" includes frame boundaries or only field presence.

- **Logprobs delivery outranks trailer suppression** — `middleware/openai.go:107`. **What:** `len(chatResponse.Logprobs) == 0` in the `isEmptyTrailer` predicate means a final response carrying only logprobs is emitted as a normal chunk, which per `middleware/openai_test.go:718-770` produces a `delta:{"content":""}` frame immediately before the finish chunk. **Why it's defensible:** logprobs on the final token would otherwise be dropped, and `server/routes.go:2806` already treats a logprobs-only message as non-empty, so the middleware now matches the handler. **Alternative cost:** suppressing the frame keeps the wire shape the PR is chasing but silently loses the last token's logprobs for every request that asked for them. **The question to answer:** when `logprobs: true` is set, the stream reacquires the exact stray empty-content frame this PR removes; does "chunk-for-chunk" have to hold in logprobs mode too, or should the logprobs be folded onto the preceding content chunk so the shape survives both modes?

## The diff in 6 layers

**Layer 1 — a delta stops being a message.** `openai/openai.go:42-49` adds a response-only `Delta` type with `omitempty` on all four fields, and `ChunkChoice.Delta` is retyped to it at line 64, so a chunk can now serialize as `"delta":{}`.

**Layer 2 — chunk construction loses its ending and gains two parameters' worth of context.** `toChunk` (`302-340`) no longer computes `FinishReason` at all, takes `includeRole` instead of `toolCallSent`, and reads `Created` from `r.CreatedAt` instead of `time.Now()`.

**Layer 3 — the ending gets its own emission.** `FinishChunk` (`368-396`) builds a chunk with `Delta{}` and a single `finish_reason` derived by an allow-list: `cmp.Or(r.DoneReason, "stop")`, then `stop`+`toolCallSent` → `tool_calls`.

**Layer 4 — the writer becomes a sequencer.** `middleware/openai.go:88-158` pins one `created` across the stream, suppresses the metrics-only trailer unless it carries logprobs or opens the stream, sends `role` only on the first emitted chunk, and orders finish → usage → `[DONE]`.

**Layer 5 — the non-streaming path is brought into line.** `ToChatCompletion` (`openai/openai.go:287-295`) switches from "tool calls always win" to the same allow-list, so a truncated tool-call response reports `length`.

**Layer 6 — 719 lines that assert bytes, not structs.** Seven new middleware stream tests with exact frame counts and `strings.Contains` on raw SSE frames, plus `map[string]any` key-presence assertions in `openai/openai_test.go`, pinning `"delta":{}`, `"choices":[]`, `"content":""`, and the absence of `role`.
