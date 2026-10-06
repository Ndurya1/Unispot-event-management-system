# Gemini 2.5 Flash assistant scaffold

This repository currently uses `RuleBasedAssistantProvider` as the safe local
fallback. The disabled adapter at
`unispot-server/app/services/assistant_gemini_provider.py.disabled` shows where
Gemini 2.5 Flash can be connected later.

The adapter is deliberately not imported by the application. Every line in the
scaffold is commented out, so it does not add a dependency, read credentials, or
change assistant behavior today.

## Placeholder configuration

Use a secret manager or an ignored local `.env` file when enabling the provider.
Never put a real key in Git, the frontend, browser code, logs, or assistant
messages.

```dotenv
# GEMINI_API_KEY=replace-with-your-google-ai-studio-key
# GEMINI_MODEL=gemini-2.5-flash
```

The model call belongs on the backend. The existing assistant route remains the
only frontend contract, and `assistant_service.py` continues to own tool
validation, authorization, confirmation, idempotency, and booking transactions.
Gemini may propose one of the six declared tools, but it must not execute SQL or
call booking services directly.

## Enablement checklist

1. Add `google-genai` to the backend dependencies and install it.
2. Add optional `gemini_api_key` and `gemini_model` settings to
   `app/core/config.py`, with `gemini-2.5-flash` as the model default.
3. Add real values only to the ignored runtime environment; keep the example
   values commented.
4. Rename the disabled module to `assistant_gemini_provider.py` and uncomment it.
5. Inject `GeminiFlashAssistantProvider()` where `process_assistant_message`
   currently selects `RuleBasedAssistantProvider`.
6. Add mocked provider tests before making it the default, including malformed
   function calls, provider timeouts, prompt-injection attempts, and confirmation
   replay.
7. Keep the rule-based provider as a fallback if Gemini is unavailable.

The scaffold follows Google's GenAI Python SDK shape for `generate_content` and
function calling. Verify the SDK version and current Gemini model availability
before enabling it.
