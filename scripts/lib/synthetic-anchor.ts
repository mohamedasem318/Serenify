/**
 * Deterministic synthetic calibration anchor for the demo cohort (📌 DECISION-17,
 * FR-031/032). One shared blob is written to every `@demo.serenify.local` profile
 * so the demo bypasses the calibration banner (has_anchor → true) without anyone
 * recording video. The values are not inference-meaningful — feature 004 never
 * runs the model on demo users; the blob only needs to be a valid, stable
 * 2958-d little-endian float32 vector (11832 bytes).
 *
 * `mulberry32` seeded at 42 makes the bytes identical across runs (FR-032), so
 * re-seeding is a zero-diff no-op for the anchor columns.
 */

export const SYNTHETIC_ANCHOR_SEED = 42;
export const ANCHOR_DIM = 2958;
export const ANCHOR_BYTE_LENGTH = ANCHOR_DIM * 4; // 11832

// Model version this synthetic anchor is tagged with. Matches docs/MODELS.md and
// the API's reported model_version (serenify-video-lbptop-motion-rf-calibrated@2.0.0).
export const SYNTHETIC_ANCHOR_MODEL_VERSION =
  "serenify-video-lbptop-motion-rf-calibrated@2.0.0";

/** mulberry32 PRNG — small, fast, fully deterministic from a 32-bit seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The raw 11832-byte little-endian float32 anchor buffer (deterministic). */
export function syntheticAnchorBytes(): Buffer {
  const rng = mulberry32(SYNTHETIC_ANCHOR_SEED);
  const buf = Buffer.alloc(ANCHOR_BYTE_LENGTH);
  for (let i = 0; i < ANCHOR_DIM; i += 1) {
    buf.writeFloatLE(rng(), i * 4); // coerces the double to float32
  }
  return buf;
}

/**
 * The anchor as a Postgres `\x`-hex bytea literal, ready to send through
 * PostgREST (supabase-js) as a JSON string value for the `anchor_vector` column.
 */
export function syntheticAnchorHex(): string {
  return `\\x${syntheticAnchorBytes().toString("hex")}`;
}
