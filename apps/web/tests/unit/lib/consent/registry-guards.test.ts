import { describe, expect, it } from "vitest";

import {
  CONSENT_REGISTRY,
  type ConsentRevision,
  type ConsentTextKey,
} from "@/lib/consent/registry";

import SNAPSHOT from "./published-revisions.snapshot.json";

/**
 * T014 — the four CI-enforced guards over the consent version registry
 * (`research.md` §6.1).
 *
 * Materiality is a human judgment written by hand at publish time, never derived from a
 * text diff or a content hash (FR-043a). These guards are what make that judgment
 * trustworthy: they enforce that every entry states its classification and its reason,
 * that version ids are unique and self-describing, that the list reads in publication
 * order, and — the load-bearing one — that published history is APPEND-ONLY.
 *
 * Both keys ship with zero entries in P2, so (a)-(c) are vacuously true today and (d)
 * compares two empty lists. That is deliberate: the mechanism must exist and be wired
 * BEFORE the first entry lands, because the snapshot is what locks it. T023 appends the
 * first `terms_privacy` revision in P3 and the guards below start biting immediately.
 *
 * The version-id grammar is the same one the database enforces independently with two
 * CHECKs on `user_consents.document_version` (`data-model.md` §6.5) — the string is the
 * join key between this registry and the stored row, so the two must agree.
 */

const KEYS: readonly ConsentTextKey[] = ["terms_privacy", "camera_inference"];

/** `<consent_key>@YYYY-MM-DD.<n>` — the DB's CHECK regex, expressed once here. */
const VERSION_ID = /^(terms_privacy|camera_inference)@\d{4}-\d{2}-\d{2}\.\d+$/;
const PUBLISHED_ON = /^\d{4}-\d{2}-\d{2}$/;

const snapshot = SNAPSHOT as unknown as Record<ConsentTextKey, readonly ConsentRevision[]>;

const allEntries = (): readonly (ConsentRevision & { key: ConsentTextKey })[] =>
  KEYS.flatMap((key) => CONSENT_REGISTRY[key].map((entry) => ({ ...entry, key })));

describe("registry shape", () => {
  it("declares exactly the two consent keys", () => {
    expect(Object.keys(CONSENT_REGISTRY).sort()).toEqual([...KEYS].sort());
  });

  it("gives every key an array of entries", () => {
    for (const key of KEYS) {
      expect(Array.isArray(CONSENT_REGISTRY[key]), `${key} must hold a list`).toBe(true);
    }
  });
});

// ── Guard (a) — explicit materiality, non-empty rationale ─────────────────────

describe("guard (a): every entry states its classification and its reason", () => {
  it.each(KEYS)("%s entries each carry an explicit materiality", (key) => {
    for (const entry of CONSENT_REGISTRY[key]) {
      expect(
        ["material", "cosmetic"],
        `${entry.versionId} must state materiality explicitly`,
      ).toContain(entry.materiality);
    }
  });

  it.each(KEYS)("%s entries each carry a non-empty rationale", (key) => {
    for (const entry of CONSENT_REGISTRY[key]) {
      expect(typeof entry.rationale, `${entry.versionId} rationale must be a string`).toBe(
        "string",
      );
      expect(
        entry.rationale.trim().length,
        `${entry.versionId} must explain why this classification was chosen — the reviewer reads it`,
      ).toBeGreaterThan(0);
    }
  });

  it("the first published revision of each text is material by definition", () => {
    for (const key of KEYS) {
      const first = CONSENT_REGISTRY[key][0];
      if (!first) continue; // no revision published yet
      expect(first.materiality, `${key}'s first revision must be material`).toBe("material");
    }
  });
});

// ── Guard (b) — unique, well-formed, self-prefixed version ids ────────────────

describe("guard (b): version ids are unique, well-formed, and prefixed with their key", () => {
  it("no version id is reused anywhere in the registry", () => {
    const ids = allEntries().map((entry) => entry.versionId);
    expect(new Set(ids).size, `duplicate version id in ${ids.join(", ")}`).toBe(ids.length);
  });

  it.each(KEYS)("%s version ids match the stored document_version grammar", (key) => {
    for (const entry of CONSENT_REGISTRY[key]) {
      expect(entry.versionId, `${entry.versionId} must match <key>@YYYY-MM-DD.<n>`).toMatch(
        VERSION_ID,
      );
    }
  });

  it.each(KEYS)("%s version ids are prefixed with their own key", (key) => {
    for (const entry of CONSENT_REGISTRY[key]) {
      expect(
        entry.versionId.startsWith(`${key}@`),
        `${entry.versionId} is filed under ${key} but does not name it`,
      ).toBe(true);
    }
  });

  it.each(KEYS)("%s publication dates are well-formed", (key) => {
    for (const entry of CONSENT_REGISTRY[key]) {
      expect(entry.publishedOn, `${entry.versionId} publishedOn must be YYYY-MM-DD`).toMatch(
        PUBLISHED_ON,
      );
    }
  });

  it.each(KEYS)("%s version ids embed their own publication date", (key) => {
    for (const entry of CONSENT_REGISTRY[key]) {
      expect(
        entry.versionId,
        `${entry.versionId} must embed its publishedOn ${entry.publishedOn}`,
      ).toContain(`@${entry.publishedOn}.`);
    }
  });
});

// ── Guard (c) — ascending publication order ──────────────────────────────────

describe("guard (c): entries are ordered by publishedOn ascending", () => {
  it.each(KEYS)("%s reads in publication order", (key) => {
    const dates = CONSENT_REGISTRY[key].map((entry) => entry.publishedOn);
    expect(dates, `${key} entries are out of publication order`).toEqual([...dates].sort());
  });

  it.each(KEYS)("%s same-day revisions are ordered by their sequence number", (key) => {
    const entries = CONSENT_REGISTRY[key];
    for (let i = 1; i < entries.length; i += 1) {
      const previous = entries[i - 1];
      const current = entries[i];
      if (!previous || !current || previous.publishedOn !== current.publishedOn) continue;
      const seq = (entry: ConsentRevision) => Number(entry.versionId.split(".").pop());
      expect(
        seq(current),
        `${current.versionId} must follow ${previous.versionId} on the same day`,
      ).toBeGreaterThan(seq(previous));
    }
  });
});

// ── Guard (d) — APPEND-ONLY against the frozen snapshot ──────────────────────

describe("guard (d): published history is append-only", () => {
  it("the snapshot covers exactly the registry's keys", () => {
    expect(
      KEYS.every((key) => Array.isArray(snapshot[key])),
      "published-revisions.snapshot.json must hold a list for every consent key",
    ).toBe(true);
  });

  it.each(KEYS)("%s never publishes fewer entries than the snapshot records", (key) => {
    expect(
      CONSENT_REGISTRY[key].length,
      `${key}: a published revision was REMOVED from the registry — history is append-only (FR-043b)`,
    ).toBeGreaterThanOrEqual(snapshot[key].length);
  });

  it.each(KEYS)("%s reproduces every snapshotted entry field-for-field", (key) => {
    snapshot[key].forEach((frozen, index) => {
      const live = CONSENT_REGISTRY[key][index];
      expect(
        live,
        `${key}[${index}] (${frozen.versionId}) is missing from the registry`,
      ).toBeDefined();
      // Field-by-field, so a failure names the field that was edited rather than
      // printing two whole objects and leaving the reader to diff them.
      expect(live?.versionId, `${frozen.versionId}: versionId was edited`).toBe(frozen.versionId);
      expect(live?.publishedOn, `${frozen.versionId}: publishedOn was edited`).toBe(
        frozen.publishedOn,
      );
      expect(live?.materiality, `${frozen.versionId}: materiality was edited`).toBe(
        frozen.materiality,
      );
      expect(live?.rationale, `${frozen.versionId}: rationale was edited`).toBe(frozen.rationale);
    });
  });

  it.each(KEYS)("%s appends only at the end — the snapshotted prefix is intact", (key) => {
    const frozenIds = snapshot[key].map((entry) => entry.versionId);
    const liveIds = CONSENT_REGISTRY[key].slice(0, frozenIds.length).map((e) => e.versionId);
    expect(
      liveIds,
      `${key}: a new revision was INSERTED among published ones instead of appended`,
    ).toEqual(frozenIds);
  });
});

// ── P2 posture: both keys ship empty, and that is the design ─────────────────

describe("P2 ships no entries", () => {
  it("declares both keys so no gate can reference a missing one", () => {
    for (const key of KEYS) {
      expect(CONSENT_REGISTRY[key]).toBeDefined();
    }
  });

  it("publishes nothing yet — terms_privacy lands in P3, camera_inference in P4", () => {
    // Delete this test in P3 when T023 appends the first terms_privacy revision.
    expect(CONSENT_REGISTRY.terms_privacy).toHaveLength(0);
    expect(CONSENT_REGISTRY.camera_inference).toHaveLength(0);
  });
});
