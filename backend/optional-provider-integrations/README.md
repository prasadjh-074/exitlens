# Optional sponsor integrations

ExitLens defines [provider contracts](../../extension/src/providers/index.ts) and implements browser-native speech. This repository currently ships a local deterministic workflow. Bedrock and ElevenLabs are planned adapters.

## Amazon Bedrock

Use a separate backend or AWS Lambda proxy with an IAM execution role limited to the chosen model. The client can call narrowly scoped operations for structured terms, button classification, ranking candidate identifiers, or plain-language obstacle descriptions.

Each operation should receive only the excerpt or candidate fields the user has approved for the named provider. Separate instructions from untrusted input in the server request. Validate output against an explicit schema. A ranking response references existing candidate IDs. The extension keeps URL checks, action approval and verification decisions in its deterministic code.

## ElevenLabs

A speech proxy can receive the user-approved text of a commitment explanation, next step, term excerpt or milestone. It returns audio or a clear unavailable result. Keep keys in server-managed credentials. The on-device voice and written guide remain the fallback.

## Trust boundary

1. Show the proposed data, provider and purpose to the user before making a remote request.
2. Strip form values, URL query strings, fragments, cookie values and account identifiers.
3. Authenticate the proxy and scope it to explicit operations. Apply timeouts, size limits and output validation.
4. Treat webpage text and model output as data. Provider responses cannot execute actions, change permissions, declare verified outcomes or nominate unobserved URLs as known paths.
5. Keep provider secrets out of the extension, source control and client logs. Production deployment and provider retention settings are integration work.
