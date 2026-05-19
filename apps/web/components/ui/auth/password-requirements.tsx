"use client";

import { Check } from "lucide-react";

type Rule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

// Source of truth for the strength rules. Mirrors the Zod schema in
// lib/auth/schemas.ts — when one moves the other must move with it.
const RULES: readonly Rule[] = [
  { id: "min", label: "At least 8 characters", test: (v) => v.length >= 8 },
  {
    id: "letter",
    label: "Contains a letter",
    test: (v) => /[A-Za-z]/.test(v),
  },
  {
    id: "number",
    label: "Contains a number",
    test: (v) => /[0-9]/.test(v),
  },
];

type Props = {
  value: string;
  /** Optional id so the input can wire aria-describedby to this region. */
  id?: string;
};

/**
 * Live password requirements checklist. Replaces the static helper
 * string "At least 8 characters with a letter and a number." with a
 * three-item list that lights up (Lucide Check, text-meadow) as the
 * user types and each rule is met. Once all three are satisfied the
 * list collapses to a single calm "Password looks good." line.
 *
 * No red anywhere — unmet items render muted with a low-opacity check
 * glyph instead of a cross, per Constitution Principle V's
 * non-alarmist voice.
 */
export function PasswordRequirements({ value, id }: Props) {
  const states = RULES.map((r) => ({ ...r, met: r.test(value) }));
  const allMet = states.every((s) => s.met);

  return (
    <div id={id} aria-live="polite" className="text-xs">
      {allMet ? (
        <p className="text-muted">Password looks good.</p>
      ) : (
        <ul className="space-y-1">
          {states.map(({ id: ruleId, label, met }) => (
            <li
              key={ruleId}
              data-met={met ? "true" : "false"}
              className={`flex items-center gap-2 ${met ? "text-meadow" : "text-muted"}`}
            >
              <Check
                aria-hidden
                className={`h-3.5 w-3.5 ${met ? "" : "opacity-30"}`}
              />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
