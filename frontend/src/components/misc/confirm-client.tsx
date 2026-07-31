"use client";

import Link from "next/link";
import { useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createAuthClient } from "@/lib/supabase/client-auth";
import { ErrorState } from "@/components/ds/error-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const VALID_TYPES = new Set<EmailOtpType>([
  "invite",
  "recovery",
  "magiclink",
  "signup",
  "email",
  "email_change",
]);

interface ConfirmClientProps {
  tokenHash: string | null;
  type: string | null;
  next: string;
}

export function ConfirmClient({ tokenHash, type, next }: ConfirmClientProps) {
  const [status, setStatus] = useState<"idle" | "verifying" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const safeNext = next.startsWith("/") ? next : "/";
  const validType =
    type && VALID_TYPES.has(type as EmailOtpType) ? (type as EmailOtpType) : null;
  const isRecovery = validType === "recovery";

  if (!tokenHash || !validType) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Link not valid</CardTitle>
          <CardDescription>
            This link is missing information or is malformed. Request a new one to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/auth/forgot-password">Request a new link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleContinue = async () => {
    setStatus("verifying");
    setError(null);

    const supabase = createAuthClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: validType,
    });

    if (verifyError) {
      setStatus("error");
      setError(verifyError.message);
      return;
    }

    window.location.href = safeNext;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          {isRecovery ? "Reset your password" : "Confirm your account"}
        </CardTitle>
        <CardDescription>
          {isRecovery
            ? "Click continue to set a new password."
            : "Click continue to finish setting up your Alleato account."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status === "error" ? (
          <>
            <ErrorState
              title="This link is invalid or has expired"
              error={
                error
                  ? `${error} — links can only be used once. Request a fresh one and try again.`
                  : "Links can only be used once and expire after a while. Request a fresh one and try again."
              }
              className="py-2"
            />
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/forgot-password">Request a new link</Link>
            </Button>
          </>
        ) : (
          <Button
            onClick={handleContinue}
            disabled={status === "verifying"}
            className="w-full"
          >
            {status === "verifying" ? "Verifying…" : "Continue"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
