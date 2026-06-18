import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary CTA. Uses Mist & Meadow's ink + bg pair directly
        // (same idiom as the (auth) submit buttons: Sign in, Create
        // account, Update password). Yields ~13:1 contrast in light
        // mode and ~14:1 in dark — well above WCAG AA. The hover
        // opacity-90 mirrors the (auth) pattern for visual continuity
        // between the sign-up funnel and the in-app primary actions.
        default: "bg-ink text-bg hover:opacity-90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // Outlined neutral (e.g. stop-confirm "Start over"). Resting text is the
        // inherited `ink`, which is dark in light mode and light in dark mode — both
        // contrasty against `bg-background`. The hover fills with `accent` (foggy,
        // LIGHT in both modes); the prior `hover:text-accent-foreground` set the text
        // to `ink`, which in DARK mode is light → light-on-light ~1.5:1 washout (the
        // reported bug). Light mode never needed an override (inherited ink is dark),
        // so we only force dark text on the dark-mode hover: `dark:hover:text-bg`
        // (~6.3:1 light / ~8.8:1 dark on the foggy hover fill — both ≥ WCAG AA).
        outline:
          "border border-input bg-background hover:bg-accent dark:hover:text-bg",
        // Secondary action with character. Outlined meadow on a
        // surface tile carries the brand accent without competing
        // with the primary's solid ink. Yields AAA contrast in both
        // modes for the ink-on-surface text (~13:1 light, ~12:1 dark)
        // and a meadow border that signals brand-button. Hover wash
        // is meadow at 10% — feedback without contrast collapse.
        secondary:
          "bg-surface text-ink border border-meadow hover:bg-meadow/10",
        // Affirmative brand CTA (feature 005 calibration: "Turn on camera",
        // "I'm ready", "Set baseline"). Solid meadow that reads unmistakably green.
        // Filled-accent foreground (FR-008/FR-014): near-white `text-on-accent` in
        // light mode, and `dark:text-bg` (the deep graphite bg) on the lighter
        // dark-mode meadow (ink/bg swap the wrong way alone). ~4.8:1 light /
        // ~7.4:1 dark — both ≥ WCAG AA.
        meadow: "bg-meadow text-on-accent hover:opacity-90 dark:text-bg",
        // Foggy CTA for the calm-but-not-forward surfaces — the primary action on
        // a FOGGY screen (post-recording failure, the three camera-access states,
        // the backend-down gate). Filled-accent foreground (FR-008/FR-014),
        // mirroring `meadow`: near-white `text-on-accent` in light mode and
        // `dark:text-bg` on the lighter dark-mode foggy (~5.3:1 light / ~8.3:1 dark
        // — both ≥ WCAG AA). The colour matches the screen's treatment so the CTA
        // never reads as a forward/meadow action.
        foggy: "bg-foggy text-on-accent hover:opacity-90 dark:text-bg",
        // Quiet tier. A low-opacity foggy wash on hover gives feedback in BOTH
        // modes without overriding the text color (mirrors `secondary`'s
        // hover:bg-meadow/10 idiom). The previous hover:bg-accent +
        // hover:text-accent-foreground set the text to `ink`, which in dark mode
        // is near-white on the light foggy `accent` bg → ~1.4:1, failing WCAG AA.
        // Inherited `ink` text stays contrasty against the page in either mode.
        ghost: "hover:bg-foggy/15",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
