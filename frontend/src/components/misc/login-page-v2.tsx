"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { apiFetchWithTimeout } from "@/lib/api-client";
import { createAuthClient } from "@/lib/supabase/client-auth";
import {
  getSafePostLoginFallback,
  POST_LOGIN_REDIRECT_TIMEOUT_MS,
  resolvePostLoginRedirect,
} from "@/lib/auth/post-login-redirect-client";
import { validateCallbackUrl } from "@/lib/validation/callback-url";
import { toast } from "sonner";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/misc/password-input";

interface LoginPageV2Props {
  redirectTo?: string;
}

export function LoginPageV2({ redirectTo }: LoginPageV2Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createAuthClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const message = "Invalid email or password. Check the test credentials or refresh the saved auth state.";
        setErrorMessage(message);
        toast.error("Sign in failed", { description: message });
        return;
      }

      toast.success("Successfully logged in");

      // Always resolve the landing server-side so a callbackUrl pointing at a
      // project the user can't access (e.g. the browser's last-viewed project
      // for a subcontractor scoped to a single job) is dropped instead of
      // dumping them onto an Access Denied wall.
      const validatedCallback =
        redirectTo && redirectTo !== "/" ? validateCallbackUrl(redirectTo) : null;
      const query =
        validatedCallback && validatedCallback !== "/"
          ? `?callbackUrl=${encodeURIComponent(validatedCallback)}`
          : "";
      try {
        const redirect = await resolvePostLoginRedirect(
          () =>
            apiFetchWithTimeout<{ redirect?: string }>(
              `/api/auth/post-login-redirect${query}`,
              { cache: "no-store" },
              POST_LOGIN_REDIRECT_TIMEOUT_MS,
            ),
          validatedCallback,
        );
        setTimeout(() => {
          router.push(redirect);
          router.refresh();
        }, 100);
      } catch (redirectError) {
        console.error("Failed to resolve post-login redirect", {
          redirectTo: validatedCallback,
          error: redirectError instanceof Error ? redirectError.message : String(redirectError),
        });
        setTimeout(() => {
          router.push(getSafePostLoginFallback());
          router.refresh();
        }, 100);
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "An unexpected error occurred while signing in.";
      setErrorMessage(message);
      toast.error("Sign in failed", { description: message });
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // `dark` flips every semantic token (foreground / muted / input) to its
    // dark-theme value; bg-login-surface (#1d1d1d) is the requested signal color
    // so the login screen is instantly distinguishable from the authed app.
    <div className="dark min-h-screen flex flex-col items-center justify-center bg-login-surface px-6 py-12">
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-sm"
      >
        {/* Logo — centered */}
        <div className="mb-10 flex justify-center">
          <Image
            src="/Alleato-Group-Logo_Light.png"
            alt="Alleato"
            width={200}
            height={50}
            priority
          />
        </div>

        {/* Heading */}
        <div className="mb-9">
          <p className="text-3xl font-light tracking-tight text-foreground leading-snug">
            Welcome back.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
          data-dev-autofill-disabled="true"
          aria-describedby={errorMessage ? "login-error" : undefined}
        >
          {/* Email */}
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-xs tracking-widest uppercase text-muted-foreground"
            >
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="h-11 bg-background text-foreground border-border focus-visible:border-border placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs tracking-widest uppercase text-muted-foreground"
            >
              Password
            </Label>
            <PasswordInput
              id="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="h-11 bg-background text-foreground border-border focus-visible:border-border placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {errorMessage ? (
            <InfoAlert id="login-error" role="alert" variant="error">
              {errorMessage}
            </InfoAlert>
          ) : null}

          {/* Submit */}
          <div className="pt-1">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 font-normal tracking-wider bg-foreground text-background hover:bg-foreground/85"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </div>

          {/* Forgot password */}
          <p className="text-sm text-center text-muted-foreground pt-1">
            <Link
              href="/auth/forgot-password"
              className="text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              Forgot your password?
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
