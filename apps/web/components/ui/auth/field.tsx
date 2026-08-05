"use client";

import { PasswordInput } from "@/components/ui/auth/password-input";

export type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
};

/**
 * Bespoke auth-surface form field. Pairs a small-caps label with either
 * a standard text input or the PasswordInput (when `type === "password"`).
 * Renders an inline error paragraph wired via aria-describedby when the
 * caller passes an `error` string.
 *
 * Extracted verbatim from the inlined `Field` previously duplicated
 * across (auth)/login-form.tsx, signup-form.tsx, reset-form.tsx so the
 * (auth) surfaces share a single primitive without changing DOM, CSS,
 * or behaviour. shadcn install lands in step 3 against `components/ui/`
 * flat; this `auth/` subfolder keeps the bespoke primitives separate
 * per plan.md Decision F.
 */
export const Field = (props: FieldProps) => {
  const { id, label, error, type, ...inputProps } = props;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-medium uppercase tracking-wide text-muted"
      >
        {label}
      </label>
      {type === "password" ? (
        <PasswordInput
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          {...inputProps}
        />
      ) : (
        <input
          id={id}
          type={type}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          {...inputProps}
          className="h-12 w-full rounded-control border border-control bg-surface px-3 text-base text-ink outline-none transition-[color,background-color,border-color] placeholder:text-muted focus-visible:border-meadow focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-meadow"
        />
      )}
      {error && (
        <p id={errorId} className="text-xs text-ink">
          {error}
        </p>
      )}
    </div>
  );
};
