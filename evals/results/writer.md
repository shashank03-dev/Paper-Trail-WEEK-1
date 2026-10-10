# Writer eval

> ⚠️ **These numbers come from the mock LLM (`scripts/mock-llm.ts`), not from Gemma.** They only prove the harness runs end to end. Run `pnpm eval:… ` against Ollama to get real numbers.

3 presets × 3 durations × 4 companion types = 36 trails per model. Plan + 4 panel calls each.

| Model | Schema-valid 1st try | Grounding rate (I-Spy) | Hallucinated places (after validation) | Fits panel | Fell back to template | Latency / trail |
| --- | --- | --- | --- | --- | --- | --- |
| `gemma4:e4b` | 100% | 78% | 0 | 100% | 0/36 | median 0.0 s |

Hallucinated places counts I-Spy ids not in the input plus capitalised place names ("X Street", "Y Cafe") in the copy that match no feature we gave the model. Validation retries should drive it to 0.
