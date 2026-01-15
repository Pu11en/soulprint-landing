# Production Standards: AWS SageMaker & Mobile Optimization

This document defines the "Best Production Grade Practices" for the SoulPrint project. The SoulPrint Architect agent adheres to these strictly.

## 1. Security & Privacy (AWS SageMaker)
- **Zero Leakage**: AWS Credentials (`AWS_ACCESS_KEY_ID`, etc.) must NEVER appear in client-side code bundles.
- **Server Actions Only**: All calls to SageMaker must happen inside `"use server"` actions or API routes.
- **Environment Isolation**: Use `.env.local` for local dev, and strict Environment Variable configuration in Vercel for production.
- **Input Sanitization**: All user inputs sent to LLMs must be sanitized to prevent prompt injection attacks.
- **Least Privilege**: The IAM User/Role used should ONLY have `sagemaker:InvokeEndpoint` permission.

## 2. Reliability & Error Handling
- **Retries**: Implement exponential backoff for `ThrottlingException` or `InternalServerError` from AWS.
- **Timeouts**: Enforce a strict timeout (e.g., 29s for Serverless Functions) to prevent hanging requests.
- **Fail-Safe**: If SageMaker fails, the UI must show a graceful error ("SoulPrint is meditating...") rather than crashing.
- **Logging**: Log all inference errors (without PII) to the server console for debugging.

## 3. Mobile Performance (60fps Goal)
- **No CLS (Cumulative Layout Shift)**: Skeleton loaders must match the exact dimensions of loaded content.
- **Touch Latency**: Use `touch-action: manipulation` to remove the 300ms click delay on iOS.
- **Passive Listeners**: Scroll event listeners must be `{ passive: true }`.
- **Bundle Size**: Import only necessary sub-modules (e.g., `import { Button }` instead of full lib if not tree-shakeable).
- **Image Optimization**: strict usage of `next/image` with `sizes` prop properly defined.

## 4. Code Quality
- **Typed Responses**: All API responses must be strongly typed with TypeScript interfaces.
- **No "Any"**: Avoid `any` type in the AI integration layer.
- **Clean Architecture**: Isolate the AWS Client in a singleton pattern to prevent connection churn.

## 5. User Experience
- **Optimistic UI**: Chat bubbles should appear immediately as "Sending..." before the server response.
- **Haptic Feedback**: Use `navigator.vibrate` (where supported) for subtle feedback on long-press interactions.
- **PWA Ready**: Ensure `manifest.json` and icons are correctly set for "Add to Home Screen".
