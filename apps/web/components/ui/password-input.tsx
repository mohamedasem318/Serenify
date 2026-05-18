"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes, type Ref } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  /** Forwarded to the underlying <input>. `react-hook-form`'s register
   *  returns a ref under this prop. Typed as a React.Ref (React 19
   *  ref-as-prop pattern) so we don't need forwardRef. */
  ref?: Ref<HTMLInputElement>;
};

/**
 * Password input with an inline Show/Hide toggle.
 *
 * - Type swaps between "password" and "text" on click.
 * - Toggle button sits inside the input on the right; the input's
 *   left/right padding (`pl-3 pr-12`) keeps the placeholder/value from
 *   sliding under the icon.
 * - Touch target is 44×44px per Constitution Principle VI.
 * - aria-label flips between "Show password" and "Hide password" so
 *   screen-reader users get a meaningful announcement.
 * - The input's class is intentionally hard-coded (matches the (auth)
 *   Field input styles) so callers can't drift away from the
 *   Mist & Meadow palette by passing a className. All other input
 *   props (id, autoComplete, onBlur, onChange, name, ref, aria-*)
 *   pass through.
 */
export function PasswordInput({ ref, ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        className="h-12 w-full rounded-control border border-border bg-surface pl-3 pr-12 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-meadow"
        {...rest}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-control text-muted transition-colors hover:bg-bg hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-meadow"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
