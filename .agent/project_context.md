# Project Context: share-installs

Open-source, self-hosted invite & deferred deep link attribution system.

## Project Overview
- **Goal**: Provide a lightweight, self-hosted alternative to Branch.io/AppsFlyer for deferred deep linking.
- **Workflow**: 
    1. Web SDK collects fingerprint on click.
    2. Mobile SDK collects fingerprint on launch.
    3. Backend matches fingerprints to resolve invite codes.

## Technology Stack
- **Backend**: Node.js (Express), TypeScript, Prisma (PostgreSQL), Redis.
- **Web SDK**: TypeScript.
- **Android SDK**: Kotlin.
- **iOS SDK**: Swift (SPM/CocoaPods).
- **Landing Page**: Next.js.
- **Infrastructure**: Docker, Terraform (AWS), Kubernetes.

## Core Architecture
- **Fingerprinting**: Fuzzy matching based on IP, UA, language, etc.
- **Matching Logic**: 
    - Exact match (if possible).
    - Fuzzy match (similarity score > threshold).
- **Storage**: Postgres for persistent invite data, Redis for short-lived click events and rate limiting.

## Development Rules
- Use TypeScript for backend and JS SDK.
- Maintain consistent API client logic across all SDKs.
- Automated testing via Jest (JS/TS), JUnit (Android), XCTest (iOS).
- **Mandatory AI Collaboration Protocol**: All AI agents must follow the structured format in `AI_COLLAB_STATUS.md` and use append-only logic for logs/changelogs. Never delete `Persistent Technical Notes`.
