2026-10-16

# Ask Web supports GPT-6 and GPT-6.1 models

Ask Web now includes GPT-6 Astra, Sol, Luna, and GPT-6.1 Sol in its built-in model suggestions while preserving the existing default. Existing API configurations retain their model lists; users can add the desired API IDs in Settings.

Custom model names were already accepted, but the request builder did not recognize GPT-6 as a reasoning model. Requests now use max_completion_tokens instead of max_tokens and omit temperature for GPT-6 and GPT-6.1 names. A configured minimal reasoning effort becomes low for these models, matching OpenAI compatibility requirements. The setting named none continues to omit the reasoning_effort parameter.

The duplicated model lists in shared.js and utils.js remain synchronized. Documentation describes how existing configurations can add the new models.

Validation: node tests/models.cjs passes, covering GPT-6 aliases and variants, GPT-5 compatibility, GPT-4.1 behavior, reasoning settings, and legacy configuration migration parity. JavaScript syntax and git diff checks passed. Live API calls were not tested.

Project commit: ebfb670 (feat: support GPT-6 and GPT-6.1 models).
