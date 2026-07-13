# Feature Specification: Brand Email and Social Preview

**Feature Branch**: `fix/brand-email-social-preview`

**Created**: 2026-07-13

**Status**: Approved

**Input**: Align transactional email branding with the app header, center email
actions, provide a polished `serenify.tech` share preview, and close the stale
force-re-sign-in follow-up after verifying the deployed behavior.

## User Scenarios & Testing

### User Story 1 - Recognizable auth emails (Priority: P1)

A user receiving confirmation or password recovery email sees Serenify's actual
wordmark treatment and a centered primary action in light or dark capable email
clients.

**Acceptance Scenarios**:

1. Both templates use the app-equivalent Outfit wordmark size, weight, line height, and spacing.
2. Both CTA table cells center their links with email-safe markup.
3. Templates preserve the existing link and six-digit OTP fallbacks.
4. Light and dark styles retain readable Graphite contrast.

### User Story 2 - Useful link unfurls (Priority: P1)

Someone sharing `serenify.tech` gets a branded image, title, and description
instead of an unconfigured generic preview.

**Acceptance Scenarios**:

1. Root metadata has the production metadata base, canonical URL, Open Graph fields, and Twitter summary card fields.
2. The Open Graph image is exactly 1200x630 and identifies Serenify with its existing icon and product description.
3. The preview is independent of authenticated application theme state.

### User Story 3 - Password reset requires re-authentication (Priority: P1)

After a successful password update, the recovery session is signed out before
the user is sent to login.

**Acceptance Scenarios**:

1. A successful password update calls update first, then sign-out.
2. A failed password update does not sign the user out.
3. BACKLOG #38 and GitHub issue #38 are resolved together.

## Requirements

- **FR-001**: Email wordmarks MUST remain text and use `Outfit, Inter, Arial, sans-serif` at 400 weight and 24px.
- **FR-002**: Email CTA cells MUST use both `align="center"` and inline centered alignment.
- **FR-003**: Existing Auth placeholders and dark-mode styles MUST remain intact.
- **FR-004**: Root metadata MUST describe the production HTTPS origin and declare Open Graph and Twitter preview data.
- **FR-005**: The social image MUST be 1200x630 and use stable, non-overlapping layout geometry.
- **FR-006**: Password update success MUST sign out the recovery session; failure MUST not.
- **FR-007**: No service-role key, RLS, database, API, model, secret, SVG, or token-remapping change is permitted.

## Success Criteria

- **SC-001**: Template contract tests pass for both templates.
- **SC-002**: Metadata and Open Graph route contract tests pass.
- **SC-003**: Password reset action tests prove sign-out ordering and error behavior.
- **SC-004**: Web test, lint, typecheck, and production build gates pass.
