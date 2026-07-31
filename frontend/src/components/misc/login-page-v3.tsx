"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { createAuthClient } from "@/lib/supabase/client-auth";
import { validateCallbackUrl } from "@/lib/validation/callback-url";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/misc/password-input";

// ─── Isometric projection ──────────────────────────────────────────────────
const CX = 440;    // screen origin x — shifted left so crane has room right
const CY = 730;    // screen ground y — higher so crane fills top of SVG
const U  = 20;     // pixels per iso unit (larger = bigger buildings)
const C  = 0.866;  // cos(30°)

function sx(ix: number, iy: number)               { return CX + (ix - iy) * U * C; }
function sy(ix: number, iy: number, iz: number)   { return CY + (ix + iy) * U * 0.5 - iz * U; }
function pt(ix: number, iy: number, iz: number)   {
  return `${sx(ix, iy).toFixed(1)},${sy(ix, iy, iz).toFixed(1)}`;
}

// ─── Building wireframe paths ──────────────────────────────────────────────
interface Bld {
  ox: number; oy: number;
  w: number;  d: number; h: number;
  floors: number;
  accent?: boolean;
  delay: number;
}

function bldPaths(b: Bld) {
  const { ox, oy, w, d, h, floors } = b;
  const struct: string[] = [
    `M${pt(ox,   oy,   0)}L${pt(ox+w, oy,   0)}`,
    `M${pt(ox,   oy,   0)}L${pt(ox,   oy+d, 0)}`,
    `M${pt(ox,   oy,   0)}L${pt(ox,   oy,   h)}`,
    `M${pt(ox+w, oy,   0)}L${pt(ox+w, oy,   h)}`,
    `M${pt(ox,   oy+d, 0)}L${pt(ox,   oy+d, h)}`,
    `M${pt(ox,oy,h)}L${pt(ox+w,oy,h)}L${pt(ox+w,oy+d,h)}L${pt(ox,oy+d,h)}Z`,
  ];
  const detail: string[] = [];
  const fh = h / floors;
  for (let f = 1; f < floors; f++) {
    const fz = f * fh;
    detail.push(`M${pt(ox,   oy, fz)}L${pt(ox+w, oy,   fz)}`);
    detail.push(`M${pt(ox,   oy, fz)}L${pt(ox,   oy+d, fz)}`);
  }
  return { struct, detail };
}

// ─── Crane paths (isometric tower crane on main building) ─────────────────
// Crane sits on the front-right corner of the main tower (ox=5, oy=2, z=22)
function cranePaths() {
  // Key crane points in iso-space
  const mx = 5,  my = 2;   // mast base x,y (front-right corner of main tower)
  const mBase = 22;         // mast base z (top of main tower)
  const mTop  = 31;         // mast top z
  const pivZ  = mTop - 1;  // jib pivot z
  const peakZ = mTop + 1;  // cat-head peak z (above pivot for tie rods)
  const jibX  = mx + 8;    // main jib tip ix
  const cjX   = mx - 3.5;  // counter-jib tip ix
  const trolX = mx + 5;    // trolley ix
  const hookZ = pivZ - 6;  // hook z (cable hangs 6 units)

  return [
    // Mast
    { d: `M${pt(mx,my,mBase)}L${pt(mx,my,mTop)}`,    sw: 1.2, accent: true,  delay: 2.0 },
    // Mast lattice braces
    { d: `M${pt(mx-0.15,my,mBase+3)}L${pt(mx+0.15,my,mBase+6)}`, sw: 0.5, accent: true, delay: 2.1 },
    { d: `M${pt(mx+0.15,my,mBase+3)}L${pt(mx-0.15,my,mBase+6)}`, sw: 0.5, accent: true, delay: 2.1 },
    { d: `M${pt(mx-0.15,my,mBase+6)}L${pt(mx+0.15,my,mBase+9)}`, sw: 0.5, accent: true, delay: 2.15 },
    { d: `M${pt(mx+0.15,my,mBase+6)}L${pt(mx-0.15,my,mBase+9)}`, sw: 0.5, accent: true, delay: 2.15 },
    // Pivot block — starts after mast finishes drawing (mast: delay 2.0 + duration 1.2 = 3.2s)
    { d: `M${pt(mx-0.3,my,pivZ)}L${pt(mx+0.3,my,pivZ)}L${pt(mx+0.3,my,pivZ+0.8)}L${pt(mx-0.3,my,pivZ+0.8)}Z`, sw: 0.9, accent: true, delay: 3.2 },
    // Main jib
    { d: `M${pt(mx,my,pivZ)}L${pt(jibX,my,pivZ)}`,   sw: 1.0, accent: true,  delay: 3.3 },
    // Counter-jib
    { d: `M${pt(mx,my,pivZ)}L${pt(cjX,my,pivZ)}`,    sw: 0.8, accent: true,  delay: 3.4 },
    // Counterweight block at end of counter-jib
    { d: `M${pt(cjX-0.4,my,pivZ-0.6)}L${pt(cjX+0.4,my,pivZ-0.6)}L${pt(cjX+0.4,my,pivZ+0.6)}L${pt(cjX-0.4,my,pivZ+0.6)}Z`, sw: 0.9, accent: true, delay: 3.5 },
    // Peak / cat-head
    { d: `M${pt(mx,my,pivZ)}L${pt(mx,my,peakZ)}`,    sw: 0.8, accent: true,  delay: 3.5 },
    // Tie rod — peak to jib tip
    { d: `M${pt(mx,my,peakZ)}L${pt(jibX,my,pivZ)}`,  sw: 0.5, accent: false, delay: 3.6 },
    // Tie rod — peak to counter-jib tip
    { d: `M${pt(mx,my,peakZ)}L${pt(cjX,my,pivZ)}`,   sw: 0.5, accent: false, delay: 3.65 },
    // Trolley (small block riding the jib)
    { d: `M${pt(trolX-0.2,my,pivZ)}L${pt(trolX+0.2,my,pivZ)}L${pt(trolX+0.2,my,pivZ-0.5)}L${pt(trolX-0.2,my,pivZ-0.5)}Z`, sw: 0.6, accent: false, delay: 3.75 },
    // Hook cable (dashed)
    { d: `M${pt(trolX,my,pivZ)}L${pt(trolX,my,hookZ)}`, sw: 0.45, accent: false, delay: 3.85, dashed: true },
    // Hook shape
    { d: `M${pt(trolX-0.25,my,hookZ)}L${pt(trolX+0.25,my,hookZ)}L${pt(trolX+0.2,my,hookZ+0.8)}L${pt(trolX-0.2,my,hookZ+0.8)}`, sw: 0.6, accent: false, delay: 3.95 },
    // Flag at peak
    { d: `M${pt(mx,my,peakZ)}L${pt(mx,my,peakZ+1.2)}`, sw: 0.5, accent: false, delay: 4.05 },
    { d: `M${sx(mx,my).toFixed(1)},${(sy(mx,my,peakZ+1.2)).toFixed(1)} L${(sx(mx,my)+16).toFixed(1)},${(sy(mx,my,peakZ+1.2)+5).toFixed(1)} L${(sx(mx,my)+16).toFixed(1)},${(sy(mx,my,peakZ+1.2)+13).toFixed(1)} Z`, sw: 0, accent: true, fill: true, delay: 4.15 },
  ];
}

// ─── Scene: buildings + crane ─────────────────────────────────────────────
const BUILDINGS: Bld[] = [
  // Core cluster
  { ox: 2,   oy: 2,  w: 3,   d: 3,   h: 22, floors: 11, accent: true,  delay: 0.2 },
  { ox: 0,   oy: 2,  w: 2,   d: 2,   h: 14, floors: 7,  delay: 0.5 },
  { ox: 5,   oy: 2,  w: 2,   d: 2,   h: 12, floors: 6,  delay: 0.6 },
  { ox: 2,   oy: 5,  w: 2,   d: 2,   h: 10, floors: 5,  delay: 0.7 },
  // Foreground
  { ox: 0,   oy: 0,  w: 1.5, d: 1.5, h: 7,  floors: 4,  delay: 0.9 },
  { ox: 5,   oy: 0,  w: 1.5, d: 1.5, h: 6,  floors: 3,  delay: 1.0 },
  // Mid-right
  { ox: 7,   oy: 2,  w: 2,   d: 2,   h: 9,  floors: 5,  delay: 0.8 },
  // Far left
  { ox: -1,  oy: 3,  w: 1.5, d: 1.5, h: 5,  floors: 3,  delay: 1.1 },
  // Background depth
  { ox: 0,   oy: 5,  w: 2,   d: 2,   h: 8,  floors: 4,  delay: 1.0 },
  { ox: 4,   oy: 6,  w: 1.5, d: 1.5, h: 6,  floors: 3,  delay: 1.15 },
  { ox: 7,   oy: 5,  w: 1.5, d: 1.5, h: 7,  floors: 4,  delay: 1.1 },
  // Extra foreground
  { ox: -1,  oy: 0,  w: 1,   d: 1,   h: 4,  floors: 2,  delay: 1.2 },
  { ox: 8,   oy: 0,  w: 1,   d: 1,   h: 3,  floors: 2,  delay: 1.2 },
];

interface CranePath {
  d: string; sw: number; accent: boolean; delay: number; dashed?: boolean; fill?: boolean;
}

interface LoginPageV3Props {
  redirectTo?: string;
}

export function LoginPageV3({ redirectTo }: LoginPageV3Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const supabase = createAuthClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Invalid email or password");
        return;
      }
      toast.success("Signed in");
      if (redirectTo && redirectTo !== "/") {
        const url = validateCallbackUrl(redirectTo);
        setTimeout(() => { router.push(url); router.refresh(); }, 100);
      } else {
        try {
          const result = await apiFetch<{ redirect?: string }>("/api/auth/post-login-redirect");
          setTimeout(() => { router.push(result?.redirect || "/"); router.refresh(); }, 100);
        } catch {
          setTimeout(() => { router.push("/"); router.refresh(); }, 100);
        }
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const crane = cranePaths();

  return (
    <>
      <style>{`
        @keyframes isoDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes isoFade {
          to { opacity: 1; }
        }
        .iso-line {
          stroke-dasharray: 3000;
          stroke-dashoffset: 3000;
          animation: isoDraw 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .iso-detail {
          opacity: 0;
          animation: isoFade 0.9s ease-out forwards;
        }
        .iso-crane {
          stroke-dasharray: 2000;
          stroke-dashoffset: 2000;
          animation: isoDraw 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .iso-crane-fill {
          opacity: 0;
          animation: isoFade 0.5s ease-out forwards;
        }
      `}</style>

      <div className="min-h-screen bg-background grid lg:grid-cols-[420px_1fr]">

        {/* ─── Left: Form panel ─── */}
        <div className="flex flex-col justify-between pl-14 pr-10 py-12 md:pl-16 md:pr-12 relative z-10">

          <motion.div
            initial={{ opacity: 0 }}
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

          <motion.div
            initial={{ opacity: 0, y: 14 }}
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

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label
                  htmlFor="email-v3"
                  className="text-xs tracking-widest uppercase text-muted-foreground"
                >
                  Email address
                </Label>
                <Input
                  id="email-v3"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 bg-background text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="password-v3"
                  className="text-xs tracking-widest uppercase text-muted-foreground"
                >
                  Password
                </Label>
                <PasswordInput
                  id="password-v3"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 bg-background text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50"
                />
              </div>

              <div className="pt-1">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 font-normal tracking-wider"
                >
                  {isLoading ? "Signing in…" : "Sign in"}
                </Button>
              </div>

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

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="text-xs tracking-widest uppercase text-muted-foreground/30"
          >
            Built for builders
          </motion.p>
        </div>

        {/* ─── Right: Isometric city ─── */}
        <div className="hidden lg:block relative overflow-hidden bg-background">
          <svg
            viewBox="0 0 850 900"
            className="absolute inset-0 w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Ground perimeter */}
            {([
              [-1,-1,10,-1,"0s"], [-1,-1,-1,9,"0.1s"],
              [10,-1,10,9,"0.12s"], [-1,9,10,9,"0.14s"],
            ] as [number,number,number,number,string][]).map(([ax,ay,bx,by,d], i) => (
              <line key={i}
                x1={sx(ax,ay)} y1={sy(ax,ay,0)}
                x2={sx(bx,by)} y2={sy(bx,by,0)}
                stroke="hsl(var(--muted-foreground) / 0.15)"
                strokeWidth="0.5"
                className="iso-line"
                style={{ animationDelay: d }}
              />
            ))}

            {/* Isometric ground grid */}
            {[1,2,3,4,5,6,7,8,9].map((n) => (
              <g key={`g${n}`}>
                <line
                  x1={sx(n,-1)} y1={sy(n,-1,0)} x2={sx(n,9)} y2={sy(n,9,0)}
                  stroke="hsl(var(--muted-foreground) / 0.045)" strokeWidth="0.3"
                  className="iso-line" style={{ animationDelay: `${0.2+n*0.015}s` }}
                />
                <line
                  x1={sx(-1,n)} y1={sy(-1,n,0)} x2={sx(10,n)} y2={sy(10,n,0)}
                  stroke="hsl(var(--muted-foreground) / 0.045)" strokeWidth="0.3"
                  className="iso-line" style={{ animationDelay: `${0.2+n*0.015}s` }}
                />
              </g>
            ))}

            {/* Buildings */}
            {BUILDINGS.map((b, bi) => {
              const { struct, detail } = bldPaths(b);
              const lineColor = b.accent
                ? "hsl(var(--primary))"
                : "hsl(var(--foreground) / 0.18)";
              const detailColor = b.accent
                ? "hsl(var(--primary) / 0.35)"
                : "hsl(var(--foreground) / 0.07)";
              return (
                <g key={bi}>
                  {struct.map((path, i) => (
                    <path key={i} d={path}
                      stroke={lineColor}
                      strokeWidth={b.accent ? "0.9" : "0.55"}
                      fill="none"
                      className="iso-line"
                      style={{ animationDelay: `${b.delay + i * 0.055}s` }}
                    />
                  ))}
                  {detail.map((path, i) => (
                    <path key={`d${i}`} d={path}
                      stroke={detailColor}
                      strokeWidth="0.35"
                      fill="none"
                      className="iso-detail"
                      style={{ animationDelay: `${b.delay + 0.8 + i * 0.012}s` }}
                    />
                  ))}
                </g>
              );
            })}

            {/* Tower crane */}
            {crane.map((seg: CranePath, i) => (
              seg.fill ? (
                <path key={`c${i}`} d={seg.d}
                  fill="hsl(var(--primary))"
                  stroke="none"
                  className="iso-crane-fill"
                  style={{ animationDelay: `${seg.delay}s` }}
                />
              ) : (
                <path key={`c${i}`} d={seg.d}
                  stroke={seg.accent ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.5)"}
                  strokeWidth={seg.sw}
                  strokeDasharray={seg.dashed ? "3,2" : undefined}
                  fill="none"
                  className="iso-crane"
                  style={{ animationDelay: `${seg.delay}s` }}
                />
              )
            ))}

            {/* Subtle accent glow under main tower */}
            <ellipse
              cx={sx(3.5, 3.5)} cy={sy(3.5, 3.5, 0)}
              rx="70" ry="22"
              fill="hsl(var(--primary) / 0.04)"
              className="iso-detail"
              style={{ animationDelay: "1.8s" }}
            />
          </svg>
        </div>
      </div>
    </>
  );
}
