"use client";

import { cn } from "@/lib/utils";
import { createAuthClient } from "@/lib/supabase/client-auth";
import { evaluatePasswordUpdateGuard } from "@/lib/auth/password-update-guard";
import { getPasswordChecks, isPasswordValid } from "@/lib/validation/password";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface UpdatePasswordFormProps extends React.ComponentPropsWithoutRef<"div"> {
  email?: string;
  next?: string;
}

export function UpdatePasswordForm({
  className,
  email,
  next,
  ...props
}: UpdatePasswordFormProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  const handleSignOut = async () => {
    const supabase = createAuthClient();
    setIsLoading(true);
    await supabase.auth.signOut();
    // Send them back to log in cleanly; they re-open the email link to set the
    // intended account's password against a fresh, correct session.
    window.location.href = "/auth/login";
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createAuthClient();
    setIsLoading(true);
    setError(null);
    setMismatch(false);

    try {
      if (!isPasswordValid(password)) {
        setError("Password does not meet all requirements");
        setIsLoading(false);
        return;
      }

      // updateUser() targets whatever session is active in this browser. Confirm
      // that session is the account this link was issued for before changing any
      // password — otherwise a stray invite/recovery link opened while signed in
      // as someone else would silently overwrite the signed-in user's password.
      const { data: userData } = await supabase.auth.getUser();
      const guard = evaluatePasswordUpdateGuard({
        sessionEmail: userData.user?.email ?? null,
        intendedEmail: email ?? null,
      });
      if (!guard.allowed) {
        setError(guard.message);
        setMismatch(guard.kind === "email-mismatch");
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      window.location.href = next && next.startsWith("/") ? next : "/";
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Could not update password — please try again");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {next ? "Create your password" : "Reset your password"}
          </CardTitle>
          <CardDescription>
            {next
              ? "Set a password to secure your account. You'll use your email and this password to log in."
              : "Please enter your new password below."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgotPassword}>
            <div className="flex flex-col gap-6">
              {email ? (
                <div className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">Username</span>
                  <span className="font-medium text-foreground">{email}</span>
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="New password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {password.length > 0 && (
                  <ul className="space-y-1 text-xs">
                    {getPasswordChecks(password).map((check) => (
                      <li
                        key={check.label}
                        className={check.met ? "text-success" : "text-muted-foreground"}
                      >
                        {check.met ? "\u2713" : "\u2022"} {check.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {mismatch ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isLoading}
                  onClick={handleSignOut}
                >
                  {isLoading ? "Signing out..." : "Sign out and try again"}
                </Button>
              ) : (
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save new password"}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
