"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/auth/field";
import {
  updateProfile,
  type UpdateProfileResult,
} from "@/app/(authed)/app/account/actions";
import { deriveInitials } from "@/lib/initials";

type ProfileSectionProps = {
  initialFullName: string;
  email: string;
};

const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Name can't be empty")
    .max(60, "Keep it under 60 characters"),
});
type ProfileInput = z.infer<typeof profileSchema>;

export function ProfileSection({
  initialFullName,
  email,
}: ProfileSectionProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitState, setSubmitState] =
    useState<UpdateProfileResult | null>(null);
  // Optimistic display: reflects the in-flight or last-saved value so the
  // section's larger avatar updates as the user types and stays in sync
  // immediately after save, ahead of the header's Server-Component re-render.
  const [displayName, setDisplayName] = useState(initialFullName);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    mode: "onBlur",
    defaultValues: { full_name: initialFullName },
  });

  // useWatch (not the watch() function returned by useForm) is the
  // memoization-safe way to read a single field reactively — matches
  // the SecuritySection / reset-form.tsx pattern and clears the
  // react-hooks/incompatible-library warning that watch() emits.
  const watchedName = useWatch({ control, name: "full_name" }) ?? "";
  const avatarName = (watchedName.trim() || displayName).trim();
  const initials = deriveInitials(avatarName || null, email);

  function onSubmit(values: ProfileInput) {
    setSubmitState(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("full_name", values.full_name);
      const result = await updateProfile(form);
      setSubmitState(result);
      if (result.status === "ok") {
        setDisplayName(values.full_name);
        // Re-baseline the form so isDirty correctly tracks future
        // changes against the just-saved value. Without this, typing
        // the OLD name back into the field still matches the stale
        // initial baseline and the Save button stays disabled —
        // surfaced during Phase 6 smoke.
        reset({ full_name: values.full_name });
        // The server action revalidatePath()-s /app and /app/account; refresh
        // here re-fetches the (authed) layout so the header avatar and
        // dropdown name pick up the new full_name on the same render
        // cycle as the form's success state — closest practical
        // approximation of FR-017's "no full reload" requirement without
        // making the Server-Component Header read from a client store.
        router.refresh();
      }
    });
  }

  return (
    <section
      aria-labelledby="account-profile-heading"
      className="space-y-6"
    >
      <header className="space-y-1.5">
        <h2
          id="account-profile-heading"
          className="font-display text-2xl leading-tight text-ink"
        >
          Profile
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          What your colleagues see when they look you up.
        </p>
      </header>

      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-surface text-foreground font-medium text-lg border border-border">
            {initials}
          </AvatarFallback>
        </Avatar>
        <p className="text-sm leading-relaxed text-muted">
          Initials update as you type your name.
        </p>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <Field
          id="full_name"
          label="Full name"
          type="text"
          autoComplete="name"
          maxLength={60}
          {...register("full_name")}
          error={errors.full_name?.message}
        />

        <div className="space-y-1.5">
          <p className="block text-xs font-medium uppercase tracking-wide text-muted">
            Email
          </p>
          <p className="text-base text-ink">{email}</p>
          <p className="text-xs leading-relaxed text-muted">
            Your email isn&apos;t editable here. Reach out if you need it changed.
          </p>
        </div>

        {submitState?.status === "invalid" && (
          <p
            role="alert"
            className="rounded-control border border-amber/50 bg-amber/10 px-3 py-2 text-sm text-ink"
          >
            {submitState.message}
          </p>
        )}

        {submitState?.status === "ok" && (
          <p
            role="status"
            className="rounded-control border border-meadow/50 bg-meadow/10 px-3 py-2 text-sm text-ink"
          >
            Saved.
          </p>
        )}

        <Button type="submit" disabled={pending || !isDirty}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </section>
  );
}
