# PharmaVault iPhone app

Native SwiftUI client for the PharmaVault TrustRAG academic MVP.

## Scope

- VisionKit camera scanning on an iPhone or iPad.
- Exactly one image page per prescription, pharmacy invoice, or claim form upload. Multi-page camera scans are rejected before images are materialized; no first-page-only upload.
- HTTPS-only API configuration, Keychain session token storage, and in-memory scan handling.
- First-launch API setup before login, verification-case upload/status and a processing action after all three document types are uploaded.
- Camera capability/permission handling, discard/rescan, duplicate-type prevention within the current mobile case, and explicit new-case reset.
- Session revalidation, endpoint-bound tokens and blocked HTTP redirects.

## Open in Xcode

Open `PharmaVault.xcodeproj`, select a development team and a unique bundle identifier, then run on a physical iPhone/iPad. Configure the reachable HTTPS URL ending in `/api` on the Welcome screen before login. The Privacy tab also permits changing it, which signs out the previous environment's session. Do not use `localhost` on a phone to refer to the laptop; do not bypass certificate validation or add broad ATS exceptions. VisionKit scanning must be checked on a supported real device. The app explains unsupported/denied/restricted camera states without opening the scanner.

Existing staff accounts require organization membership and administrator provisioning. Public self-registration is patient-only. This client does not grant reviewer roles.

## Verification status (U4)

Implemented; acceptance remains PARTIAL. Swift source parsing and project/plist lint pass. The shared pure Swift policy smoke passes 9/9 groups. These checks do NOT build the UIKit/SwiftUI application or exercise VisionKit, Keychain, image uploads or the device camera. Only Command Line Tools are active; the full Xcode/device gate is unrun. The installed SwiftPM manifest interface/runtime also has a linker mismatch, so XCTest execution has not passed on this host.

From this directory, run `sh scripts/check-policy.sh` for the independent policy executable. On a working Swift toolchain, `swift test` exercises the XCTest versions under `Tests/`. Neither is a substitute for an iOS build.

## Device acceptance checklist

1. Clean launch: empty/invalid API configuration cannot sign in; HTTPS configuration is available without an account/session.
2. Build using the shared scheme on iOS 17+, then sign in to a reachable test backend. Verify staff/submitter decoding and fractional server timestamps.
3. Camera allow/deny/restrict, unsupported hardware, cancel and scanner failure do not crash. A denied user can reach Settings.
4. Scan two pages: nothing is selected/uploaded. Rescan one page, inspect it, change document type (old scan clears), discard, and scan again.
5. Upload three synthetic pages, one per document type. Inspect actual stored bytes through the authenticated web workflow. Oversized output and duplicate document types are rejected. Run verification and inspect the returned state; final adjudication remains on the web.
6. Relaunch: a valid Keychain session is revalidated. A 401 signs out; a connectivity/TLS failure permits retry without pretending the session is authenticated. Changing the backend never forwards an old token, including delayed requests and redirects.
7. Background the app: the pending scan is discarded. Starting another case resets local state without deleting the earlier server case. Sign out clears local authentication state.
8. Rehearse failed upload/processing recovery. No external LLM payload, scan or patient document should appear in logs.

## Deliberate MVP limits

- The app does not store scans in the photo library or on disk.
- The current mobile flow uploads one image page per document type. Multi-page PDF review belongs to the web/backend workflow and remains subject to U3 safety acceptance.
- New-case/upload progress is in memory, not an offline/resumable capture queue. Network retries are not claimed as server-idempotent uploads.
- The app does not contain a Gemini key, JWT secret, database password, or production credential.
- It supports verification workflow only; it does not diagnose patients or automatically approve/reject claims.
