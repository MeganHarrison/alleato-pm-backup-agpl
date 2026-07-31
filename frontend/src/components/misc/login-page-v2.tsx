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
    <>
      <style>{`
        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes windowLight {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
        @keyframes craneSwing {
          0% { transform: rotate(-3deg); }
          100% { transform: rotate(0deg); }
        }

        /* Building structure draw-in */
        .bld-draw {
          stroke-dasharray: 2000;
          stroke-dashoffset: 2000;
          animation: draw 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .bld-draw-slow {
          stroke-dasharray: 2000;
          stroke-dashoffset: 2000;
          animation: draw 1.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .bld-fade {
          opacity: 0;
          animation: fadeIn 0.5s ease-out forwards;
        }
        .bld-fade-up {
          opacity: 0;
          transform: translateY(8px);
          animation: fadeInUp 0.4s ease-out forwards;
        }
        .bld-window-glow {
          animation: windowLight 3s ease-in-out infinite;
        }
        .bld-crane-arm {
          transform-origin: 430px 95px;
          animation: craneSwing 1s cubic-bezier(0.4, 0, 0.2, 1) 2.4s forwards;
          transform: rotate(-3deg);
        }
      `}</style>

      <div className="min-h-screen bg-background grid lg:grid-cols-[420px_1fr] relative overflow-hidden">

        {/* ─── Left: Editorial Login Form ─── */}
        <div className="flex flex-col justify-between pl-14 pr-10 py-12 md:pl-16 md:pr-12 relative z-10">

          {/* Logo — top left */}
          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Image
              src="/Alleato-Group-Logo_Dark.png"
              alt="Alleato"
              width={152}
              height={38}
              priority
            />
          </motion.div>

          {/* Form — vertically centered */}
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="mb-9">
              <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">
                Project Management
              </p>
              <p className="text-3xl font-light tracking-tight text-foreground leading-snug">
                Welcome back.<br />
                <span className="text-muted-foreground">Sign in to continue.</span>
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
                  className="h-11 bg-background text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50"
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
                  className="h-11 bg-background text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50"
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
                  className="w-full h-11 font-normal tracking-wider"
                >
                  {isLoading ? "Signing in..." : "Sign in"}
                </Button>
              </div>

              {/* Forgot password */}
              <p className="text-sm text-center text-muted-foreground pt-1">
                <Link
                  href="/auth/forgot-password"
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Forgot your password?
                </Link>
              </p>
            </form>
          </motion.div>

          {/* Tagline — bottom */}
          <motion.p
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="text-xs tracking-widest uppercase text-muted-foreground/30"
          >
            Built for builders
          </motion.p>
        </div>

        {/* ─── Right: Animated Building Scene ─── */}
        <div className="hidden lg:flex relative overflow-hidden items-center justify-center">
          {/* Subtle ground gradient */}
          <div
            className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none bg-gradient-to-t from-primary/5 to-transparent"
          />

          <svg
            viewBox="0 0 800 900"
            className="w-full max-w-2xl relative z-10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ marginBottom: "-2px" }}
          >
            {/* ── Ground plane ── */}
            <line
              x1="0" y1="850" x2="800" y2="850"
              stroke="hsl(var(--muted-foreground) / 0.45)" strokeWidth="2"
              className="bld-draw" style={{ animationDelay: "0s" }}
            />
            <line
              x1="50" y1="850" x2="750" y2="850"
              stroke="#334155" strokeWidth="1"
              className="bld-draw" style={{ animationDelay: "0.1s" }}
            />

            {/* ── MAIN BUILDING (center, 16 floors) ── */}
            {/* Foundation / base slab */}
            <rect
              x="200" y="830" width="300" height="20"
              fill="hsl(var(--secondary))"
              className="bld-fade" style={{ animationDelay: "0.3s" }}
            />
            <rect
              x="200" y="830" width="300" height="2"
              fill="#334155"
              className="bld-fade" style={{ animationDelay: "0.35s" }}
            />

            {/* Outer walls - left and right edges */}
            <line
              x1="200" y1="850" x2="200" y2="130"
              stroke="hsl(var(--muted-foreground) / 0.55)" strokeWidth="3"
              className="bld-draw-slow" style={{ animationDelay: "0.5s" }}
            />
            <line
              x1="500" y1="850" x2="500" y2="130"
              stroke="hsl(var(--muted-foreground) / 0.55)" strokeWidth="3"
              className="bld-draw-slow" style={{ animationDelay: "0.6s" }}
            />

            {/* Structural columns */}
            {[250, 310, 370, 440].map((x, i) => (
              <line
                key={`col-${x}`}
                x1={x} y1="850" x2={x} y2="130"
                stroke="hsl(var(--muted-foreground) / 0.55)" strokeWidth="1.5"
                className="bld-draw-slow"
                style={{ animationDelay: `${0.7 + i * 0.08}s` }}
              />
            ))}

            {/* Floor slabs - 16 floors */}
            {Array.from({ length: 16 }, (_, i) => {
              const y = 830 - (i + 1) * 43;
              return (
                <g key={`floor-${i}`}>
                  {/* Floor line */}
                  <line
                    x1="198" y1={y} x2="502" y2={y}
                    stroke="hsl(var(--muted-foreground) / 0.55)" strokeWidth="2"
                    className="bld-draw"
                    style={{ animationDelay: `${1.0 + i * 0.06}s` }}
                  />
                  {/* Floor fill */}
                  <rect
                    x="200" y={y} width="300" height="3"
                    fill="hsl(var(--muted-foreground) / 0.45)"
                    className="bld-fade"
                    style={{ animationDelay: `${1.1 + i * 0.06}s` }}
                  />
                </g>
              );
            })}

            {/* Roof slab + parapet */}
            <rect
              x="195" y="126" width="310" height="6"
              fill="hsl(var(--muted-foreground) / 0.55)"
              className="bld-fade" style={{ animationDelay: "2.0s" }}
            />
            <line
              x1="195" y1="122" x2="505" y2="122"
              stroke="#64748b" strokeWidth="1.5"
              className="bld-draw" style={{ animationDelay: "2.1s" }}
            />

            {/* ── Windows (4 columns x 15 visible floors) ── */}
            {Array.from({ length: 15 }, (_, floor) =>
              Array.from({ length: 4 }, (_, col) => {
                const x = 215 + col * 68;
                const y = 830 - (floor + 1) * 43 + 8;
                const delay = 1.8 + floor * 0.04 + col * 0.03;
                const isLit =
                  (floor + col) % 3 !== 0 && (floor * col + floor) % 4 !== 0;
                return (
                  <g key={`w-${floor}-${col}`}>
                    {/* Window frame */}
                    <rect
                      x={x} y={y} width="48" height="30" rx="1"
                      fill={isLit ? "hsl(var(--muted-subtle) / 0.8)" : "hsl(var(--muted-subtle) / 0.65)"}
                      stroke="hsl(var(--muted-foreground) / 0.55)" strokeWidth="0.5"
                      className="bld-fade"
                      style={{ animationDelay: `${delay}s` }}
                    />
                    {/* Window glass/light */}
                    <rect
                      x={x + 1} y={y + 1} width="46" height="28" rx="0.5"
                      fill={isLit ? "hsl(var(--primary))" : "hsl(var(--muted-subtle) / 0.55)"}
                      fillOpacity={isLit ? 0.25 : 0.3}
                      className={`bld-fade ${isLit ? "bld-window-glow" : ""}`}
                      style={{
                        animationDelay: `${delay}s`,
                        ...(isLit
                          ? { animationDelay: `${delay}s, ${delay + 1}s` }
                          : {}),
                      }}
                    />
                    {/* Mullion (center vertical bar) */}
                    <line
                      x1={x + 24} y1={y + 2} x2={x + 24} y2={y + 28}
                      stroke="hsl(var(--muted-foreground) / 0.55)" strokeWidth="0.5"
                      className="bld-fade"
                      style={{ animationDelay: `${delay + 0.1}s` }}
                    />
                  </g>
                );
              })
            )}

            {/* ── Building entrance / lobby ── */}
            <rect
              x="310" y="800" width="80" height="30" rx="2"
              fill="hsl(var(--muted-subtle) / 0.8)" stroke="hsl(var(--muted-foreground) / 0.55)" strokeWidth="1"
              className="bld-fade" style={{ animationDelay: "2.2s" }}
            />
            <rect
              x="316" y="803" width="32" height="24" rx="1"
              fill="hsl(var(--primary))" fillOpacity="0.2"
              className="bld-fade" style={{ animationDelay: "2.3s" }}
            />
            <rect
              x="352" y="803" width="32" height="24" rx="1"
              fill="hsl(var(--primary))" fillOpacity="0.2"
              className="bld-fade" style={{ animationDelay: "2.35s" }}
            />
            {/* Canopy */}
            <line
              x1="300" y1="798" x2="400" y2="798"
              stroke="hsl(var(--muted-foreground))" strokeWidth="2"
              className="bld-draw" style={{ animationDelay: "2.4s" }}
            />

            {/* ── SMALLER BUILDING (left, 8 floors) ── */}
            <rect
              x="70" y="830" width="110" height="20"
              fill="hsl(var(--secondary))"
              className="bld-fade" style={{ animationDelay: "0.4s" }}
            />
            <line
              x1="70" y1="850" x2="70" y2="490"
              stroke="hsl(var(--muted-foreground) / 0.35)" strokeWidth="2"
              className="bld-draw-slow" style={{ animationDelay: "0.8s" }}
            />
            <line
              x1="180" y1="850" x2="180" y2="490"
              stroke="hsl(var(--muted-foreground) / 0.35)" strokeWidth="2"
              className="bld-draw-slow" style={{ animationDelay: "0.9s" }}
            />
            {/* Floors */}
            {Array.from({ length: 8 }, (_, i) => {
              const y = 830 - (i + 1) * 42;
              return (
                <line
                  key={`sf-${i}`}
                  x1="70" y1={y} x2="180" y2={y}
                  stroke="hsl(var(--muted-foreground) / 0.35)" strokeWidth="1.5"
                  className="bld-draw"
                  style={{ animationDelay: `${1.2 + i * 0.06}s` }}
                />
              );
            })}
            {/* Small building windows */}
            {Array.from({ length: 7 }, (_, floor) =>
              Array.from({ length: 2 }, (_, col) => {
                const x = 82 + col * 50;
                const y = 830 - (floor + 1) * 42 + 8;
                const delay = 2.0 + floor * 0.04;
                const lit = (floor + col) % 2 === 0;
                return (
                  <rect
                    key={`sw-${floor}-${col}`}
                    x={x} y={y} width="36" height="26" rx="1"
                    fill={lit ? "hsl(var(--primary))" : "hsl(var(--muted-subtle) / 0.55)"}
                    fillOpacity={lit ? 0.15 : 0.2}
                    stroke="hsl(var(--muted-foreground) / 0.55)" strokeWidth="0.5"
                    className="bld-fade"
                    style={{ animationDelay: `${delay}s` }}
                  />
                );
              })
            )}
            {/* Roof */}
            <rect
              x="68" y="486" width="114" height="5"
              fill="hsl(var(--muted-foreground) / 0.35)"
              className="bld-fade" style={{ animationDelay: "2.0s" }}
            />

            {/* ── BACKGROUND BUILDING (right, taller but faded) ── */}
            <line
              x1="560" y1="850" x2="560" y2="200"
              stroke="hsl(var(--muted-foreground) / 0.45)" strokeWidth="2"
              className="bld-draw-slow" style={{ animationDelay: "0.6s" }}
            />
            <line
              x1="720" y1="850" x2="720" y2="200"
              stroke="hsl(var(--muted-foreground) / 0.45)" strokeWidth="2"
              className="bld-draw-slow" style={{ animationDelay: "0.7s" }}
            />
            {Array.from({ length: 14 }, (_, i) => {
              const y = 850 - (i + 1) * 45;
              return (
                <line
                  key={`bf-${i}`}
                  x1="560" y1={y} x2="720" y2={y}
                  stroke="hsl(var(--muted-foreground) / 0.45)" strokeWidth="1"
                  className="bld-draw"
                  style={{ animationDelay: `${1.0 + i * 0.05}s` }}
                />
              );
            })}
            {/* Faint windows */}
            {Array.from({ length: 12 }, (_, floor) =>
              Array.from({ length: 3 }, (_, col) => {
                const x = 574 + col * 48;
                const y = 850 - (floor + 1) * 45 + 10;
                return (
                  <rect
                    key={`bw-${floor}-${col}`}
                    x={x} y={y} width="34" height="26" rx="1"
                    fill="hsl(var(--muted-subtle) / 0.55)" fillOpacity="0.3"
                    className="bld-fade"
                    style={{ animationDelay: `${2.0 + floor * 0.03}s` }}
                  />
                );
              })
            )}

            {/* ── TOWER CRANE ── */}
            {/* Crane mast (on main building) */}
            <line
              x1="430" y1="830" x2="430" y2="80"
              stroke="hsl(var(--primary))" strokeWidth="4"
              className="bld-draw-slow" style={{ animationDelay: "1.8s" }}
            />
            {/* Mast lattice lines */}
            {Array.from({ length: 12 }, (_, i) => {
              const y1 = 800 - i * 60;
              return (
                <g key={`latt-${i}`}>
                  <line
                    x1="426" y1={y1} x2="434" y2={y1 - 30}
                    stroke="hsl(var(--primary))" strokeWidth="0.8" opacity="0.5"
                    className="bld-draw"
                    style={{ animationDelay: `${2.0 + i * 0.04}s` }}
                  />
                  <line
                    x1="434" y1={y1} x2="426" y2={y1 - 30}
                    stroke="hsl(var(--primary))" strokeWidth="0.8" opacity="0.5"
                    className="bld-draw"
                    style={{ animationDelay: `${2.0 + i * 0.04}s` }}
                  />
                </g>
              );
            })}

            {/* Crane slew (pivot) */}
            <rect
              x="422" y="88" width="16" height="10" rx="2"
              fill="hsl(var(--primary))"
              className="bld-fade" style={{ animationDelay: "2.3s" }}
            />

            {/* Crane jib (arm) + counter-jib */}
            <g className="bld-crane-arm">
              {/* Main jib to the left */}
              <line
                x1="240" y1="95" x2="430" y2="95"
                stroke="hsl(var(--primary))" strokeWidth="3"
              />
              {/* Counter-jib to the right */}
              <line
                x1="430" y1="95" x2="530" y2="95"
                stroke="hsl(var(--primary))" strokeWidth="2.5"
              />
              {/* Counterweight */}
              <rect x="510" y="90" width="25" height="12" rx="1" fill="hsl(var(--primary))" />
              {/* Tie rods (cables from peak to jib ends) */}
              <line
                x1="430" y1="70" x2="240" y2="95"
                stroke="hsl(var(--muted-foreground) / 0.75)" strokeWidth="0.8"
              />
              <line
                x1="430" y1="70" x2="530" y2="95"
                stroke="hsl(var(--muted-foreground) / 0.75)" strokeWidth="0.8"
              />
              {/* Peak / cat head */}
              <line
                x1="430" y1="95" x2="430" y2="65"
                stroke="hsl(var(--primary))" strokeWidth="3"
              />
              <polygon points="425,65 435,65 430,58" fill="hsl(var(--primary))" />

              {/* Trolley on jib */}
              <rect x="305" y="91" width="12" height="6" rx="1" fill="hsl(var(--muted-foreground) / 0.75)" />
              {/* Hook cable */}
              <line
                x1="311" y1="97" x2="311" y2="180"
                stroke="hsl(var(--muted-foreground) / 0.75)" strokeWidth="1" strokeDasharray="3,2"
              />
              {/* Hook */}
              <path
                d="M307,180 L315,180 L313,190 C313,194 309,194 309,190 Z"
                fill="hsl(var(--muted-foreground) / 0.75)"
              />
              {/* Suspended beam */}
              <rect
                x="295" y="192" width="32" height="6" rx="1"
                fill="hsl(var(--muted-foreground))"
                className="bld-fade" style={{ animationDelay: "3.0s" }}
              />
            </g>

            {/* ── Flag on crane peak ── */}
            <g
              className="bld-fade-up"
              style={{ animationDelay: "3.2s" }}
            >
              <line
                x1="430" y1="58" x2="430" y2="38"
                stroke="hsl(var(--foreground) / 0.9)" strokeWidth="1"
              />
              <polygon points="430,38 450,44 430,50" fill="hsl(var(--primary))" opacity="0.8" />
            </g>

            {/* ── Ground details ── */}
            {/* Construction fence posts */}
            {Array.from({ length: 6 }, (_, i) => {
              const x = 520 + i * 30;
              return (
                <g key={`fence-${i}`}>
                  <line
                    x1={x} y1="850" x2={x} y2="838"
                    stroke="hsl(var(--muted-foreground))" strokeWidth="1"
                    className="bld-fade"
                    style={{ animationDelay: `${2.5 + i * 0.05}s` }}
                  />
                  {i < 5 && (
                    <line
                      x1={x} y1="842" x2={x + 30} y2="842"
                      stroke="hsl(var(--primary))" strokeWidth="0.8" opacity="0.5"
                      className="bld-draw"
                      style={{ animationDelay: `${2.6 + i * 0.05}s` }}
                    />
                  )}
                </g>
              );
            })}

            {/* Scaffolding on left side of main building */}
            <g>
              {Array.from({ length: 5 }, (_, i) => {
                const y = 830 - i * 85;
                return (
                  <g key={`scaff-${i}`}>
                    <line
                      x1="190" y1={y} x2="190" y2={y - 85}
                      stroke="hsl(var(--muted-foreground) / 0.55)" strokeWidth="1" opacity="0.4"
                      className="bld-draw"
                      style={{ animationDelay: `${2.8 + i * 0.06}s` }}
                    />
                    <line
                      x1="185" y1={y - 42} x2="200" y2={y - 42}
                      stroke="hsl(var(--muted-foreground) / 0.55)" strokeWidth="0.8" opacity="0.3"
                      className="bld-draw"
                      style={{ animationDelay: `${2.9 + i * 0.06}s` }}
                    />
                  </g>
                );
              })}
            </g>

            {/* Small equipment on ground */}
            <rect
              x="100" y="840" width="20" height="10" rx="1"
              fill="hsl(var(--muted-foreground) / 0.35)"
              className="bld-fade" style={{ animationDelay: "3.0s" }}
            />
            <rect
              x="540" y="842" width="14" height="8" rx="1"
              fill="hsl(var(--muted-foreground) / 0.35)"
              className="bld-fade" style={{ animationDelay: "3.1s" }}
            />
          </svg>
        </div>
      </div>
    </>
  );
}
