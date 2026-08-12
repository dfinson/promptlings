# `finish_reason` moves to its own chunk, and the tests outweigh the source almost six to one

*A 949-line change to Ollama's `/v1/chat/completions` streaming path that rewrites which JSON keys appear in which SSE frame, closing a bug report that had been open since November 2024, and spending 719 of its 846 added lines proving the bytes came out right.*

The most interesting line in this diff is a comment in a test:

```go
	// Wire-format checks that struct round-tripping cannot catch: the finish
	// chunk serializes an empty delta object with no content key, and the usage
	// chunk carries an explicit empty choices array (not null).
```

That comment explains the whole shape of the PR. Four files changed. `middleware/openai.go` gains 57 lines, `openai/openai.go` gains 70. The two test files gain 462 and 257. When the entire contract is "which keys appear in which frame," a test that unmarshals into your own struct and compares fields is testing your struct against itself. The added test lines name `map[string]any` twenty-six times and reach for `strings.Contains(frames...)` ten times. That is not test padding. That is the only assertion layer that can see the bug class this PR exists to fix.

## The bug report that named its own mechanism

Issue [#7626](https://github.com/ollama/ollama/issues/7626) was filed on 2024-11-12 with the title "Role field should not be repeated in streamed response chunks." It came out of a code review on [pydantic/logfire#545](https://github.com/pydantic/logfire/pull/545), where a contributor pasted a live capture from a local Ollama and wrote one sentence that is the entire justification for a third of this diff:

> The message still appears in the logfire UI, but has the concatenated role.

Concatenated. Not "wrong," not "duplicated." Concatenated, because of exactly one branch in `openai-python`'s stream accumulator, in `src/openai/lib/streaming/_deltas.py`:

```python
        if isinstance(acc_value, str) and isinstance(delta_value, str):
            acc_value += delta_value
```

The accumulator has no notion of which fields are cumulative and which are constant. It sees two strings under the same key and adds them. `to_dict()` defaults to `exclude_unset=True`, so a delta that omits `role` contributes nothing; a delta that sets `role` on every chunk contributes `"assistant"` every time. Six chunks of "The answer is secret." and the snapshot's role is `assistantassistantassistantassistantassistantassistant`. The logfire screenshot in that review comment is what that looks like in a production observability UI.

The old code produced that string unconditionally, from a struct field with no escape hatch:

```go
			Delta: Message{Role: "assistant", Content: r.Message.Content, ToolCalls: toolCalls, Reasoning: r.Message.Thinking},
```

`Message.Role` is tagged `json:"role"` with no `omitempty`. There was no value you could put in that field to make the key disappear. Which is the first thing to understand about this PR: the fix for a bug filed in 2024 was not a condition, it was a type.

## Everything here is a serialization decision

The new type is eight lines and carries a comment stating its entire purpose:

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

`ChunkChoice.Delta` changes from `Message` to `Delta`, and with it the chunk delta loses the `Name` and `ToolCallID` fields that `Message` carries. Neither was ever set on a chunk, so nothing moves on the wire. What moves is that `role` and `content` became omittable at all.

Then look at `Content any` and read it against the line in `toChunk` that fills it:

```go
	// Content is typed as any with omitempty: nil is omitted, "" is kept.
	// Use the string value from the response so empty-string content (e.g. first
	// chunk or reasoning-only) is explicitly serialized as "content":"".
	var content any = r.Message.Content
```

In `api/types.go`, `Message.Content` is a plain `string`:

```go
	Content string `json:"content"`
```

so the interface in `toChunk` is never nil: it always holds a `string`, possibly `""`. And Go's `encoding/json` decides emptiness on the interface value, not the thing inside it. From `src/encoding/json/encode.go`:

```go
func isEmptyValue(v reflect.Value) bool {
	switch v.Kind() {
	case reflect.Array, reflect.Map, reflect.Slice, reflect.String:
		return v.Len() == 0
	case reflect.Bool,
		reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr,
		reflect.Float32, reflect.Float64,
		reflect.Interface, reflect.Pointer:
		return v.IsZero()
	}
	return false
}
```

`reflect.Interface` falls into the `IsZero()` arm, and an interface holding `""` is not the zero interface. So `any("")` under `omitempty` serializes as `"content":""`, while `nil` under the same tag disappears. One struct tag, two behaviors, selected by whether the caller assigns a typed empty string or an untyped nil. Change `Content` from `any` to `string` and the first chunk silently stops carrying `"content":""`, which is precisely the frame OpenAI opens every stream with. That is a lot of contract riding on an interface box, and it is why the test that guards it decodes into a map and checks key presence rather than value:

```go
	content, hasContent := delta["content"]
	if !hasContent {
		t.Fatalf("expected content key to be present for empty-string content, got %v", delta)
	}
```

The same nil-versus-empty distinction shows up one level out, in the usage frame. `finishChunk.Choices = []openai.ChunkChoice{}` assigns an empty non-nil slice, which Go encodes as `[]`; a nil slice under the same `json:"choices"` tag would encode as `null`. OpenAI's own `stream_options` documentation is explicit that this is load-bearing: "an additional chunk will be streamed before the `data: [DONE]` message ... and the `choices` field will always be an empty array." The test pins the literal bytes.

```go
	if !strings.Contains(frames[2], `"choices":[]`) {
		t.Fatalf("expected usage frame with empty choices, got %s", frames[2])
	}
```

## The chunk that says nothing

The old streaming loop had one output path. Chunks came out of `ToChunks`, and the last one to come out carried the finish reason, because `toChunk` computed it inline from `r.DoneReason`. If the response was `Done`, the middleware then reached back into the slice it had already written to build a usage frame:

```go
		if chatResponse.Done {
			c := openai.ToChunk(w.id, chatResponse, w.toolCallSent)
			if len(chunks) > 0 {
				c = chunks[len(chunks)-1]
			} else {
				slog.Warn("ToChunks returned no chunks; falling back to ToChunk for usage chunk", "id", w.id, "model", chatResponse.Model)
			}
```

That is a warning log guarding a case that cannot happen, next to a deprecated function kept alive to service it. `ToStreamChunks` returns either a one-element or a two-element slice and has no other exit. The new code replaces the whole apparatus with a five-word comment:

```go
			// ToStreamChunks always emits at least one chunk.
			w.firstChunkSent = true
```

and a new constructor that owes nothing to the chunk stream that preceded it:

```go
	return ChatCompletionChunk{
		Id:                id,
		Object:            "chat.completion.chunk",
		Created:           created,
		Model:             r.Model,
		SystemFingerprint: "fp_ollama",
		Choices: []ChunkChoice{{
			Index:        0,
			Delta:        Delta{},
			FinishReason: &reason,
		}},
	}
```

`Delta{}` is where the all-`omitempty` type pays out: zero role, nil content, zero reasoning, nil tool calls, all four gone, `"delta":{}`. `TestFinishChunk_JSONDeltaEmpty` decodes the frame generically and asserts the delta map has zero keys, which is the only way to state "no keys" as an assertion.

The removal that goes with it is quieter and worth a second look. The old package held this:

```go
var finishReasonToolCalls = "tool_calls"
```

a mutable package-level string whose address was handed out to every chunk that finished on tool calls (`return &finishReasonToolCalls`). Every concurrent stream on the process pointed at the same variable. Nobody ever wrote through it. It is gone now, replaced by `&reason` on a function-local, and the test that referenced the package var by name had to be rewritten along with it.

## Deny list, allow list, and the two functions that had to agree

The finish-reason rule is nine lines of the diff and took three of the six commits to settle. That history is legible in the branch and it is the most instructive thing here.

The PR opened with a deny list in the new `FinishChunk`:

```go
	reason := r.DoneReason
	if reason != "length" && toolCallSent {
		reason = "tool_calls"
	}
	if reason == "" {
		reason = "stop"
	}
```

Read that as a policy and it says: once a tool call has been streamed, relabel the terminal reason as `tool_calls` unless it is specifically `length`. Which means an unknown or absent reason gets relabeled too. The reviewer named the failure mode and wrote the replacement in the comment box:

> This is a good catch about us confusingly saying `tool_calls` for an unfinished response. Maybe we should be even more cautious here and only modify known cases where we're absolutely confident we want to change them. How about something like
>
> ```
> reason := cmp.Or(r.DoneReason, "stop")
> if reason == "stop" && toolCallSent {
>     reason = "tool_calls"
> }
> ```

Commit `6c3b059` applied it verbatim, added the `cmp` import, and wrote down why (the elided lines record that `tool_calls` overrides only `stop`, so an unfinished or unknown done reason is never relabeled):

```go
	// Only remap known terminal reasons; pass anything else through untouched.
	// ...
	reason := cmp.Or(r.DoneReason, "stop")
	if reason == "stop" && toolCallSent {
		reason = "tool_calls"
	}
```

Then, later the same day, the same reviewer noticed that only half the codebase had converted:

> oops I think we probably want to mirror the allow list approach here too, something like
>
> ```
> if reason == "stop" && len(toolCalls) > 0 {
>     reason = "tool_calls"
> }
> ```

The non-streaming path, `ToChatCompletion`, had been separately patched earlier in the branch from its original unconditional `if len(toolCalls) > 0` to a deny-list `if len(toolCalls) > 0 && reason != "length"`. The final commit of the PR is a one-line diff bringing it into alignment, plus a four-line test:

```diff
-				if len(toolCalls) > 0 && reason != "length" {
+				if reason == "stop" && len(toolCalls) > 0 {
```

Two functions, two different input signals (`toolCallSent`, remembered across the stream, versus `len(toolCalls) > 0`, read off the completed message), one rule. The whole arc from "relabel everything except X" to "relabel only Y" is the difference between a deny list and an allow list on a vocabulary you do not own, and the test table records the exact case that separates them:

```go
		{
			name:           "unknown_reason_not_relabeled_tool_calls",
			doneReason:     "unload",
			toolCallSent:   true,
			expectedReason: "unload",
		},
```

`unload` is a real string in this codebase. `server/routes.go` sets `DoneReason: "unload"` when a chat request expires the runner. It is also not in OpenAI's vocabulary: `openai-python` declares `finish_reason: Optional[Literal["stop", "length", "tool_calls", "content_filter", "function_call"]]`. So the allow list resolves one mislabeling by admitting a different one, and the test names it as intended behavior rather than an accident. More on that below.

One consequence of `cmp.Or` deserves its own sentence, because it changes a wire value nobody's comment mentions. `DoneReason.String()` in `llm/server.go` ends with `default: return ""`. Under the old code, an empty done reason produced a nil `*string` and the terminal chunk serialized `"finish_reason": null`. Under `cmp.Or(r.DoneReason, "stop")`, it serializes `"finish_reason": "stop"`. The v1 surface now asserts a clean stop in a case where the runner declined to say.

## The trailer that was never a chunk

Real Ollama streams do not end on the last token. They end on a metrics-only response: `Done: true` with an empty message and the eval counters filled in. Under the old code that produced a visible frame, because `toChunk` had no way to decline. The capture in the PR description shows it:

```jsonc
// data: 3
{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":"stop"}
```

That frame is doing two jobs: it is the finish signal, and it is a content delta that happens to be empty. Splitting the finish reason onto its own chunk means the empty content delta has no remaining job, so the middleware learns to recognize and skip it:

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

Five conjuncts, and the fifth was not in the first commit. The reviewer caught it:

> I think you also want to check whether `r.Logprobs == 0`. There are a few other places in the codebase where we consider a logprobs-only message to be non-empty

The follow-up commit message spells out what would have happened without it: "A Done response that carries the last token's logprobs with an empty message was being treated as the metrics-only trailer, silently dropping its logprobs." The regression test writes a `Done` response whose only payload is one logprob and counts frames:

```go
	frames := sseDataFrames(recorder.Body.String())
	// content + logprobs chunk + finish + [DONE]
	if len(frames) != 4 {
		t.Fatalf("expected 4 SSE data frames (content + logprobs + finish + [DONE]), got %d:\n%s", len(frames), recorder.Body.String())
	}
	if !strings.Contains(frames[1], `"logprob":-0.1`) {
```

The `w.firstChunkSent` conjunct is the other half of the guard, and the comment tells you which direction it protects. A completion that is empty from its very first response is not a trailer, because there is nothing for it to trail. It falls through, gets a chunk with `role` and `"content":""`, and only then gets the finish chunk. The test asserts the byte sequence directly:

```go
	if !strings.Contains(frames[0], `"role":"assistant"`) || !strings.Contains(frames[0], `"content":""`) {
		t.Fatalf("expected initial role chunk with empty content, got %s", frames[0])
	}
```

Note what this whole construct is: a heuristic that infers producer intent from payload shape. The chat handler knows perfectly well that it is sending the metrics trailer. The middleware has to work it out from five field checks, and the logprobs round proves the cost of getting the set wrong is a silent drop rather than a loud failure.

## One timestamp for the whole stream

Go back to that 2024 logfire capture and read the envelope rather than the delta:

```
{"id":"chatcmpl-804","choices":[{"delta":{"content":"The","role":"assistant"},"index":0}],"created":1731398387,...}
{"id":"chatcmpl-804","choices":[{"delta":{"content":" answer","role":"assistant"},"index":0}],"created":1731398388,...}
```

`created` moves between chunk one and chunk two. Six chunks in one completion, two distinct `created` values, because `toChunk` stamped `Created: time.Now().Unix()` on each one as it was built. The reviewer flagged the same thing from the other direction, noting that the PR's own description promised a single timestamp while the code only reused one for the final chunk:

> isn't this where we need to re-use the same timestamp for every chunk? I see below the final chunk re-uses one of the timestamps, but I think the goal is for all of them to use the same timestamp?

The fix lands in two places. `toChunk` stops reading the clock and reads the response instead, falling back only when the response has none:

```go
	created := r.CreatedAt.Unix()
	if r.CreatedAt.IsZero() {
		created = time.Now().Unix()
	}
```

That alone is not enough, because the server stamps every streamed response independently: `server/routes.go` builds each one with `CreatedAt: time.Now().UTC()` inside the per-token callback. So the writer holds the first value and overwrites every subsequent response with it before conversion:

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

Overwriting the decoded response before handing it to the converters makes one field authoritative for both `ToStreamChunks` and `FinishChunk` without threading it through two signatures. The test feeds three responses stamped ten seconds apart and asserts all three emitted frames carry the first:

```go
		if got := raw["created"]; got != float64(1700000000) {
			t.Fatalf("expected all chunks to share created=1700000000, got %v in %s", got, frame)
		}
```

`float64(1700000000)` because the assertion goes through `map[string]any`, again. The stream-level timestamp test has to work in generic JSON, because a typed `int64` field would have compared equal to itself no matter which clock produced it; only the unit-level `TestFinishChunk_UsesResponseCreatedAt`, which constructs one chunk from one known response, can afford to read the field directly.

## The rename that exists to break you

One more review round left a mark worth reading, because it is a decision about blast radius rather than about bytes. `ToChunks` was exported. Its third parameter was `toolCallSent bool`. The new semantics needed `includeRole bool`. Same type, same position, inverted meaning in most call sites.

> small nit: but since this is exported, changing the meaning of the third param could silently cause bugs in callers that don't know they need to change this param (though don't expect too many). Maybe keep the old param as well, or change the name or something similar?

The commit that answers it is titled "openai: rename ToChunks to ToStreamChunks" and its message states the reasoning without hedging: "Since the function is exported, a silent semantic change could break external callers without a compile error. Rename the function so old callers break loudly at compile time instead of misbehaving at runtime." The deprecated `ToChunk` wrapper went out in the same pass, along with its last test. Inside the repo the change is mechanical: `middleware/openai.go` is the only non-test caller of either function.

The same reasoning applies, unstated, to `ChunkChoice.Delta` changing from `Message` to `Delta`. Any external code constructing a `ChunkChoice` with a `Message` literal now fails to compile. That is the identical failure mode the rename was chosen to produce, arrived at by a different route.

## Why the tests are the deliverable

Fourteen net-new test functions, six renames, one deletion. The distribution is what tells you what the author was worried about. `openai/openai_test.go` gets the unit-level table for `FinishChunk` and the JSON-shape tests for individual chunks. `middleware/openai_test.go` gets seven new tests that drive an actual `ChatWriter` against an `httptest.NewRecorder`, write real `api.ChatResponse` values through `Write`, split the recorder body on `\n\n`, and count frames.

Frame counting is the assertion style that dominates, and it is the one that would have caught the metrics-trailer regression:

```go
	frames := sseDataFrames(recorder.Body.String())
	if len(frames) != 4 {
		t.Fatalf("expected 4 SSE data frames (content + finish + usage + [DONE]), got %d:\n%s", len(frames), recorder.Body.String())
	}
```

Every pre-existing streaming test in the middleware file had to have its frame count incremented, because every stream now emits exactly one more frame than it used to. `2` became `3`. `4` became `5`. All twenty deleted lines in that file come from the two tests those two edits sit in, and they are the clearest single statement of what this PR does: it does not change what a stream says, it changes how many frames it takes to say it.

CI is green across `test (ubuntu-latest)`, `test (macos-latest)`, and `test (windows-latest)`. Which matters more than usual here, because `TestToStreamChunks_EmptyContentChunkJSON` asserting that `"content"` is present for empty-string content is an empirical check on `encoding/json`'s `omitempty` semantics under this module's declared `go 1.26.0`. The interface-boxing trick in `toChunk` is not just documented, it is continuously verified.

---

## Design forks for reviewer judgment

* **Empty-string content versus omitted content on reasoning-bearing chunks**: `openai/openai.go:315-318` and `openai/openai.go:351-353`. `toChunk` documents that empty content should be explicit ("empty-string content (e.g. first chunk or reasoning-only) is explicitly serialized as `content:""`"), and `ToStreamChunks` then overrides exactly that case in the split path with `reasoningChunk.Choices[0].Delta.Content = nil`. Net effect: a thinking-only response with no content and no tool calls emits `"content":""`, while a reasoning chunk split off from a mixed response omits the key. The options: always emit `"content":""` on reasoning chunks; always omit it; or keep the current path-dependent split. What differs: whether the wire distinguishes "this delta had no content" from "this delta had empty content." For `openai-python` specifically the two converge, because `accumulate_delta` assigns the delta value when the key is absent and concatenates when both sides are strings, and `"" + x == x`. The axis is clients that branch on key presence rather than value. What would settle it: a capture of what OpenAI emits on a reasoning-bearing chunk from a model that exposes reasoning in chat completions, or a decision that `reasoning` is an Ollama extension whose framing is Ollama's to define.

* **How far "match the wire format" extends**: `openai/openai.go:66` and `openai/openai.go:145`, both outside the diff but determining the shape of every frame in it. `ChunkChoice.Logprobs` and `ChatCompletionChunk.Usage` are both pointers tagged `omitempty`, so absent means "key missing." The PR's own captured OpenAI reference frames carry `"logprobs":null` on every chunk shown and `"refusal":null` inside the opening delta, and OpenAI's `stream_options` documentation states that with `include_usage` set, "All other chunks will also include a `usage` field, but with a null value." The diff pins `delta:{}`, `choices:[]`, `"content":""`, role-once, and one shared `created`, and leaves null-versus-absent for `logprobs`, `usage`, and `refusal` where it found it. The options: parity on values only (current); parity on keys and values; or an explicit, documented subset. What differs: strict-schema clients and clients that test `"logprobs" in chunk` see a different stream from clients that read values. What would settle it: whether the goal is passing a specific client's conformance path (the `openai-python` accumulator, which tolerates missing keys) or byte-level parity with `api.openai.com`.

* **Inferring the metrics trailer from payload shape**: `middleware/openai.go:98-107`. The trailer is detected with a five-way conjunction over `Done`, `firstChunkSent`, `Message.Content`, `Message.Thinking`, `Message.ToolCalls`, and `Logprobs`, rather than signaled by the producer that knows it is sending a trailer. The options: keep the structural sniff; have the chat handler mark the final metrics response explicitly on `api.ChatResponse`; or drop the special case and accept the extra empty frame. What differs: every future field on `api.ChatResponse` that can carry payload on a `Done` response must be added to this conjunction or it is silently dropped from the v1 stream, and the failure is invisible rather than loud. This is not hypothetical: `len(chatResponse.Logprobs) == 0` was missing from the first commit and was added in `f3c8e81` after review, with the commit message "silently dropping its logprobs." What would settle it: whether `api.ChatResponse` is expected to grow more per-chunk payload fields, and whether the `/api/chat` handler is willing to carry a trailer marker for the benefit of a middleware.

## Implicit bets (reviewer should agree or push back)

* **An unreported done reason now reads as a clean stop**: `openai/openai.go:374`. **What:** `reason := cmp.Or(r.DoneReason, "stop")` maps an empty `DoneReason` to `"stop"`. `DoneReason.String()` in `llm/server.go:264-266` has a `default: return ""` branch, and `DoneReasonConnectionClosed` is declared at `llm/server.go:255`. Under the old chunk builder, an empty reason returned a nil `*string` and serialized `"finish_reason": null`. **Why it's defensible:** OpenAI's schema treats `finish_reason` as nullable only on non-terminal chunks; a terminal chunk with `null` is a shape no OpenAI client is written against, and clients that switch on the finish reason would have to handle a fourth state. **Alternative cost:** preserving `null` means every consumer of the terminal chunk needs a nil branch, and the `[DONE]` sentinel becomes the sole unambiguous end-of-stream marker. **The question to answer:** is the v1 surface permitted to assert `stop` for a completion whose runner did not report a terminal reason, or should an unreported reason remain distinguishable from a clean stop?

* **Ollama's done-reason vocabulary passes through into an OpenAI-typed field**: `openai/openai.go:371-377` and `openai/openai.go:287-295`, with `TestFinishChunk` case `unknown_reason_not_relabeled_tool_calls` pinning it. **What:** any `DoneReason` other than `"stop"` is forwarded verbatim as `finish_reason`, including strings OpenAI does not define. `server/routes.go:2490` emits `DoneReason: "unload"`; `openai-python` declares `finish_reason: Optional[Literal["stop", "length", "tool_calls", "content_filter", "function_call"]]`. The v1 middleware rejects empty `messages` with a 400 at `middleware/openai.go:452`, so the local unload branch at `server/routes.go:2482` is not reachable through `/v1/chat/completions`; the cloud passthrough at `server/routes.go:2543-2557` marshals an upstream `api.ChatResponse` and writes it straight into `ChatWriter`, so a remote host's done reason does reach this code path. **Why it's defensible:** the allow list exists precisely so that an unknown terminal state is not misreported as a known one, and relabeling `unload` as `stop` would claim the model finished when it did not. **Alternative cost:** coercing unknown reasons into the OpenAI enum loses information and reintroduces the mislabeling the reviewer objected to; forwarding them means a strictly-validating client can reject a chunk on an enum violation. **The question to answer:** for an unknown terminal reason, should the v1 surface preserve Ollama's vocabulary or stay inside OpenAI's declared enum, and if the latter, which member?

* **The `openai` package breaks external callers on purpose, twice**: `openai/openai.go:64` and `openai/openai.go:345`. **What:** `ToChunks` is renamed to `ToStreamChunks` specifically so stale callers fail to compile, and `ChunkChoice.Delta` changes type from `Message` to `Delta`, which breaks any external construction of a `ChunkChoice` the same way. The rename commit states the reasoning: "Rename the function so old callers break loudly at compile time instead of misbehaving at runtime." The deprecated `ToChunk` wrapper is deleted in the same pass; `middleware/openai.go` is the only in-repo non-test caller of either. **Why it's defensible:** the third parameter's meaning inverted from `toolCallSent` to `includeRole` with an identical signature, which is the failure mode where a silent semantic change is worse than a build break. **Alternative cost:** keeping `ToChunks` as a shim means carrying a function whose parameter is a lie, or adding a fifth conversion entry point to a package that just removed one. **The question to answer:** does `github.com/ollama/ollama/openai` carry any stability expectation for importers outside this repo, and if so, does a rename plus a struct field type change belong in the same release as a wire-format change?

## The diff in 4 layers

**Layer 1: types.** A `Delta` struct with four `omitempty` fields exists where chunk deltas previously reused `Message`, and `ChunkChoice.Delta` points at it, so a chunk delta can now serialize as `{}` and `role` can be absent.

**Layer 2: converters.** `openai.ToStreamChunks` produces content-bearing chunks with no finish reason and an optional `role`; `openai.FinishChunk` produces a terminal chunk that carries nothing but `finish_reason`; both read `created` off the response rather than the clock, and `ToChatCompletion` adopts the same allow-list finish-reason rule for the non-streaming path.

**Layer 3: the writer.** `ChatWriter` gains `firstChunkSent` and `createdAt`, pins the stream's timestamp from the first response, suppresses the metrics-only trailer's empty content chunk, and emits the finish chunk after the content chunks and before the optional usage chunk.

**Layer 4: the assertions.** Fourteen new tests decode frames as `map[string]any` or match raw substrings to pin the properties the type system cannot express: `"delta":{}`, `"choices":[]`, `"content":""` present, `role` absent after the first frame, one `created` across the stream, and the exact frame count of every stream shape the middleware can produce.
