"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();

  return (
    <>
      <style>{`
        .nf-root {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background-color: hsl(24 15% 7%);
          color: hsl(0 0% 98%);
        }

        /* Blueprint grid — two-level grid like architectural drawings */
        .nf-root::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(hsl(29 71% 52% / 0.03) 1px, transparent 1px),
            linear-gradient(90deg, hsl(29 71% 52% / 0.03) 1px, transparent 1px),
            linear-gradient(hsl(29 71% 52% / 0.015) 1px, transparent 1px),
            linear-gradient(90deg, hsl(29 71% 52% / 0.015) 1px, transparent 1px);
          background-size: 80px 80px, 80px 80px, 16px 16px, 16px 16px;
          pointer-events: none;
        }

        /* Radial vignette */
        .nf-root::after {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 70% at 50% 50%, transparent 30%, hsl(24 15% 7% / 0.88) 100%);
          pointer-events: none;
        }

        .nf-container {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 2rem;
          max-width: 560px;
          animation: nf-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes nf-enter {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .nf-hat {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: hsl(29 71% 52% / 0.15);
          border: 1px solid hsl(29 71% 52% / 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 2rem;
          animation: nf-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both;
        }

        .nf-code {
          font-size: clamp(6rem, 18vw, 10rem);
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.04em;
          margin-bottom: 1.5rem;
          background: linear-gradient(
            160deg,
            hsl(29 90% 72%) 0%,
            hsl(29 71% 52%) 50%,
            hsl(26 70% 36%) 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: nf-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
        }

        .nf-title {
          font-size: 1.375rem;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: hsl(0 0% 96%);
          margin-bottom: 0.625rem;
          animation: nf-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
        }

        .nf-desc {
          font-size: 0.9375rem;
          color: hsl(0 0% 98%);
          line-height: 1.6;
          margin-bottom: 2.5rem;
          max-width: 380px;
          animation: nf-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
        }

        .nf-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: center;
          animation: nf-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both;
        }

        .nf-divider {
          position: absolute;
          bottom: 2.5rem;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: hsl(29 20% 35%);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
          animation: nf-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both;
        }

        .nf-divider::before,
        .nf-divider::after {
          content: "";
          width: 40px;
          height: 1px;
          background: hsl(29 20% 20%);
        }

        /* Corner registration marks — blueprint aesthetic */
        .nf-mark {
          position: absolute;
          width: 20px;
          height: 20px;
          opacity: 0.3;
        }
        .nf-mark::before,
        .nf-mark::after {
          content: "";
          position: absolute;
          background: hsl(29 71% 52%);
        }
        .nf-mark::before { width: 1px; height: 100%; left: 0; top: 0; }
        .nf-mark::after  { width: 100%; height: 1px; left: 0; top: 0; }

        .nf-mark--tl { top: 2rem; left: 2rem; }
        .nf-mark--tr { top: 2rem; right: 2rem; transform: scaleX(-1); }
        .nf-mark--bl { bottom: 2rem; left: 2rem; transform: scaleY(-1); }
        .nf-mark--br { bottom: 2rem; right: 2rem; transform: scale(-1); }

        /* Dark button override for this dark page */
        .nf-btn-secondary {
          background: hsl(24 10% 13%) !important;
          border-color: hsl(24 10% 20%) !important;
          color: hsl(0 0% 80%) !important;
        }
        .nf-btn-secondary:hover {
          background: hsl(24 10% 17%) !important;
          color: hsl(0 0% 96%) !important;
        }
      `}</style>

      <div className="nf-root">
        {/* Blueprint corner marks */}
        <div className="nf-mark nf-mark--tl" />
        <div className="nf-mark nf-mark--tr" />
        <div className="nf-mark nf-mark--bl" />
        <div className="nf-mark nf-mark--br" />

        <div className="nf-container">
          <div className="nf-hat">
            <HardHat size={24} color="hsl(29 71% 62%)" />
          </div>

          <div className="nf-code">404</div>

          <h1 className="nf-title">Page not found</h1>

          <p className="nf-desc">
            This section isn't in the build plan. The page you're looking for
            may have moved, been removed, or never existed.
          </p>

          <div className="nf-actions">
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="nf-btn-secondary gap-1.5"
            >
              <ArrowLeft size={15} />
              Go back
            </Button>

            <Button asChild>
              <Link href="/">Take me home</Link>
            </Button>
          </div>
        </div>

      </div>
    </>
  );
}
