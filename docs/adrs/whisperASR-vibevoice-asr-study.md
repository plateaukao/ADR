# WhisperASR VibeVoice-ASR Feasibility Study

## Problem

Microsoft released [VibeVoice-ASR](https://github.com/microsoft/VibeVoice/blob/main/docs/vibevoice-asr.md), a unified speech-to-text model with compelling features that WhisperASR lacks:

- **60-minute single-pass processing** (64K token context) — preserves global speaker/semantic coherence across long recordings instead of slicing into chunks.
- **Joint ASR + diarization + timestamping** — produces "Who said What When" in one pass. WhisperASR previously attempted sherpa-onnx diarization and reverted due to poor quality on non-English content.
- **Customized hotwords** to bias recognition toward domain-specific names and terms.
- **50+ languages** with native code-switching.

Question: what's the effort to integrate VibeVoice-ASR into the current WhisperASR macOS app?

## Current Stack

| Layer | Implementation |
|-------|----------------|
| UI | SwiftUI, macOS 14+, arm64 only |
| Inference | whisper.cpp C library via Swift C interop |
| GPU | Metal (via whisper.cpp's Metal backend) |
| Model format | GGML (`ggml-model.bin`, ~3 GB, Breeze-ASR-25) |
| Packaging | Single `.app` bundle, Developer ID signed, no external runtime |
| Audio | `AVAssetReader` → 16 kHz mono Float32 PCM |

Everything is native, self-contained, and offline. This is the baseline to preserve.

## VibeVoice-ASR Requirements

From the upstream docs:

- **Model size:** 7B parameters (VibeVoice-ASR-7B). Roughly **14 GB in fp16**, ~7 GB int8-quantized — vs. 3 GB for the current GGML model.
- **Official runtimes:** PyTorch/HF Transformers, or vLLM. No C/C++ port.
- **Target hardware:** NVIDIA GPU with flash-attention. Docs recommend running inside NVIDIA's PyTorch Docker container.
- **Apple Silicon:** Not mentioned anywhere. PyTorch MPS backend *might* work but has never been validated by Microsoft.
- **License:** MIT, so redistribution is fine.

## Integration Options Evaluated

### Option 1: Python Sidecar

Bundle a Python interpreter + PyTorch + HF Transformers + VibeVoice model inside the `.app`. Swift launches the Python process and communicates via stdin/stdout or a local socket.

**Pros:**
- Fastest path — Microsoft's reference implementation works out of the box.
- No model porting work.

**Cons:**
- App bundle balloons from ~50 MB to **multi-GB** (Python runtime ~100 MB + torch ~1 GB + model ~7–14 GB).
- Cold-start latency: PyTorch import + 7B model load = many seconds.
- Code signing / notarization burden: every `.so`/`.dylib` in the embedded Python needs to be signed for Gatekeeper. This is painful and brittle.
- No Metal acceleration unless the model actually runs on MPS — likely CPU-only and slow.
- Breaks the "native, single binary, signed, Metal-accelerated" character of the app.

**Effort:** ~1–2 weeks for a prototype, but ongoing maintenance cost is high.

### Option 2: MLX Port

Port the VibeVoice architecture to Apple's [MLX](https://github.com/ml-explore/mlx) framework. This is the native Apple Silicon route — same approach the community took for Whisper, Llama, etc.

**Pros:**
- Runs natively on Apple Silicon GPU.
- Single binary, no Python, no sidecar.
- Reasonable performance on M-series chips.

**Cons:**
- **No MLX port exists yet.** Someone has to write it.
- VibeVoice likely has custom layers/tokenizer logic that need reimplementation.
- 7B model at fp16 still needs ~14 GB RAM — viable on 32 GB+ Macs, tight on 16 GB.

**Effort:** Weeks to months, depending on how custom the architecture is. Best done upstream in the `mlx-examples` community, not in this app.

### Option 3: CoreML Conversion

Convert the HF model to CoreML via `coremltools` and load it from Swift directly.

**Pros:**
- Fully native, no Python, no extra runtime.
- Can target Neural Engine in addition to GPU.

**Cons:**
- 7B is at the upper edge of what `coremltools` handles reliably.
- Custom ops in the architecture often fail to convert or fall back to CPU.
- CoreML's KV-cache story for transformer decoders is awkward for streaming/long-form.
- Conversion is typically a weeks-long iterative process of finding and working around unsupported ops.

**Effort:** Weeks, outcome uncertain.

### Option 4: Remote API

Call a hosted VibeVoice endpoint (Azure, HF Inference, or self-hosted).

**Pros:**
- Days of work. No model shipping.
- User's machine stays light.

**Cons:**
- **Breaks the offline / private-by-default model** that is a core product property.
- Ongoing hosting cost, or dependency on a third party's uptime.
- Large audio uploads over the network for each transcription.

**Effort:** Low, but philosophically wrong for this app.

### Option 5: llama.cpp-style C/C++ Port

A community port analogous to whisper.cpp — would be a natural fit for the current Swift bridge.

**Status:** Does not exist. Would require someone to rewrite the model in C/C++ with GGML/Metal support. Out of scope for this project.

## Comparison

| Option | Preserves native app | Offline | Effort | Risk |
|--------|---------------------|---------|--------|------|
| Python sidecar | ❌ | ✅ | Medium | Signing/notarization pain, huge bundle, slow |
| MLX port | ✅ | ✅ | High | Port doesn't exist; needs to be built |
| CoreML | ✅ | ✅ | High | Conversion may fail on custom ops |
| Remote API | ✅ (UI only) | ❌ | Low | Breaks product character |
| C/C++ port | ✅ | ✅ | Very high | Port doesn't exist |

## Recommendation

**Do not integrate VibeVoice-ASR now.**

None of the available paths preserve the app's current properties (native, single signed binary, Metal-accelerated, offline, small bundle) without substantial multi-week investment. The features VibeVoice offers — long context, integrated diarization, hotwords — are genuinely attractive, but the cost/benefit doesn't land.

**Revisit when either of these happens:**
1. A community MLX port appears in `mlx-examples` or similar. Then integration becomes a Swift bridge job, comparable to what was done for whisper.cpp.
2. A llama.cpp-style C/C++ port with Metal support appears. Same story.

Until then, the current whisper.cpp + Breeze-ASR-25 stack remains the right choice for this app. If long-form coherence becomes a user pain point before a native port exists, a narrower investment — e.g., better chunk-stitching in the existing whisper pipeline — is more cost-effective than swapping the whole inference engine.

## Key Files (for future integration work)

| File | Role |
|------|------|
| `Sources/WhisperASR/TranscriptionService.swift` | C interop layer; any new engine plugs in here |
| `Sources/WhisperASR/AudioLoader.swift` | Produces 16 kHz mono Float32 PCM — input format most ASR models expect |
| `Sources/WhisperASR/TranscriptionItem.swift` | Result data model; would need fields for speaker labels |
| `Sources/WhisperASR/SettingsView.swift` | Model path setting; would need per-engine configuration |
| `Scripts/build_whisper_lib.sh` | Template for how a native ASR engine is built into the project |

## Lessons Learned

- **Upstream runtime matters as much as model quality.** A better model that only runs via PyTorch+CUDA is effectively unavailable to a native macOS app until the ecosystem catches up with an MLX/llama.cpp/CoreML port.
- **Model size has packaging consequences.** Going from 3 GB to 7–14 GB isn't just a download — it changes update cadence, distribution channel (Mac App Store size limits), and first-run UX.
- **"Just shell out to Python" is rarely just that on macOS.** Gatekeeper, notarization, and the size of the PyTorch dependency tree make Python sidecars a real architectural commitment, not a quick hack.
- **Track ports, not just models.** When evaluating a new ASR/LLM model for native integration, the first question is "does an MLX / llama.cpp / CoreML port exist?" — not "how good is the model?"
