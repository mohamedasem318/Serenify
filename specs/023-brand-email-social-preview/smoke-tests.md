# Smoke Tests: Brand Email and Social Preview

## Transactional Emails

- [x] Confirmation preview has readable light and dark treatments.
- [x] Recovery preview has readable light and dark treatments.
- [x] Wordmark resembles the application header and both CTA buttons are centered.
- [x] Link and six-digit OTP fallback remain present.

## Link Preview

- [x] `serenify.tech` metadata resolves to the production HTTPS origin.
- [x] Open Graph image renders at 1200x630 without clipping or overlap.
- [x] Icon, Serenify name, and product description remain legible at preview size.

## Password Reset

- [x] Successful password update ends the recovery session and routes to login.
