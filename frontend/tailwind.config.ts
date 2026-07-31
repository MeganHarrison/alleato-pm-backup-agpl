const tailwindcssAnimateModule = require("tailwindcss-animate");
const tailwindScrollbarHideModule = require("tailwind-scrollbar-hide");

const tailwindcssAnimate =
  tailwindcssAnimateModule.default ?? tailwindcssAnimateModule;
const tailwindScrollbarHide =
  tailwindScrollbarHideModule.default ?? tailwindScrollbarHideModule;

/**
 * Tailwind CSS Configuration — Alleato brand / Superhuman-inspired v2
 *
 * Design system tokens mapped from CSS variables in globals.css.
 * Key changes from v1:
 * - Primary color: Alleato orange (#DB802D) with white button text
 * - Background: white with true-white cards
 * - Shadows: minimal (only shadow-sm on floating elements)
 * - Typography: Inter with OpenType, tighter headings
 * - Animations: spring physics, Superhuman timing
 */

const config = {
  darkMode: ["class", ".dark"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    // Streamdown markdown renderer uses Tailwind classes ([&>p]:inline, [li_&]:pl-6)
    // that must be scanned so they are included in the generated CSS.
    "./node_modules/streamdown/dist/*.js",
  ],
  theme: {
    extend: {
      /* =================================================================
         COLOR SYSTEM — Alleato brand semantic tokens
         ================================================================= */
      colors: {
        /* Vristo template colors — used by (dashboard) route components */
        "white-light": "#e0e6ed",
        "white-dark": "#888ea8",
        "dark": { DEFAULT: "#3b3f5c", light: "#eaeaec" },
        "danger": { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        "primary-light": "#eaf1ff",
        "secondary-light": "#ebe4f7",
        "success-light": "#ddf5f0",
        "danger-light": "#fff5f5",
        "warning-light": "#fff9ed",
        "info-light": "#e7f7ff",

        /* Core UI Colors */
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        /* Brand Colors */
        brand: {
          DEFAULT: "hsl(var(--brand))",
          hover: "hsl(var(--brand-hover))",
          light: "hsl(var(--brand-light))",
        },

        /* Surface Colors */
        "surface-inverse": "hsl(var(--surface-inverse))",
        "surface-elevated": "hsl(var(--surface-elevated))",
        "surface-summary": "hsl(var(--surface-summary))",

        /* Semantic Status Colors */
        status: {
          success: "hsl(var(--status-success))",
          warning: "hsl(var(--status-warning))",
          error: "hsl(var(--status-error))",
          info: "hsl(var(--status-info))",
        },

        /* Component Colors */
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          surface: "hsl(var(--primary) / 0.15)", /* subtle tinted bg: avatars, table headers, chips */
        },
        action: {
          DEFAULT: "hsl(var(--action))",
          foreground: "hsl(var(--action-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          subtle: "hsl(var(--muted-subtle))",
          foreground: "hsl(var(--muted-foreground))",
        },
        neutral: {
          150: "hsl(var(--neutral-150))",
        },

        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },

        light: {
          DEFAULT: "hsl(var(--light))",
        },

        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          surface: "hsl(var(--status-error-bg))",
          border: "hsl(var(--status-error-border))",
        },

        /* Semantic Status Colors (shorthand — use instead of raw color classes) */
        success: {
          DEFAULT: "hsl(var(--status-success))",
          foreground: "hsl(0 0% 100%)",
          surface: "hsl(var(--status-success-bg))",
          border: "hsl(var(--status-success-border))",
        },
        warning: {
          DEFAULT: "hsl(var(--status-warning))",
          foreground: "hsl(0 0% 100%)",
          surface: "hsl(var(--status-warning-bg))",
          border: "hsl(var(--status-warning-border))",
        },
        info: {
          DEFAULT: "hsl(var(--status-info))",
          foreground: "hsl(0 0% 100%)",
        },
        fixed: {
          DEFAULT: "hsl(var(--status-fixed))",
          foreground: "hsl(0 0% 100%)",
        },
        link: {
          DEFAULT: "hsl(var(--status-info))",
          hover: "hsl(214 80% 42%)",
        },

        /* Form Colors */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        /* Chart Colors */
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },

        /* Sidebar Colors (required for shadcn sidebar/dashboard blocks) */
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },

      /* =================================================================
         BORDER RADIUS
         ================================================================= */
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      /* =================================================================
         TYPOGRAPHY — Inter + OpenType, Superhuman-style type scale
         ================================================================= */
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Consolas", "Monaco", "Liberation Mono", "monospace"],
        nunito: ["Nunito", "sans-serif"], // Vristo template font
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.75rem" }], // 10px
      },
      letterSpacing: {
        "widest-plus": "0.2em",
        "wide-plus": "0.15em",
        "heading": "-0.01em",  // Superhuman-style tight headings
      },
      lineHeight: {
        "tighter": "1.05",
        "compact": "1.29",     // table rows (18px / 14px)
      },

      /* =================================================================
         SPACING & SIZING
         ================================================================= */
      maxWidth: {
        "8xl": "1800px",
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },

      /* =================================================================
         ANIMATIONS — Superhuman timing system
         ================================================================= */
      transitionDuration: {
        "0": "0ms",           // --transition-instant
        "100": "100ms",       // --transition-fast
        "150": "150ms",       // --transition-normal
        "200": "200ms",       // --transition-spring
        "250": "250ms",
        "350": "350ms",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",       // smooth decel
        "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",     // slight overshoot
      },
      keyframes: {
        move: {
          "0%": { transform: "translateX(-200px)" },
          "100%": { transform: "translateX(200px)" },
        },
        orbit: {
          "0%": { transform: "rotate(calc(var(--angle) * 1deg)) translateY(calc(var(--radius) * 1px)) rotate(calc(var(--angle) * -1deg))" },
          "100%": { transform: "rotate(calc(var(--angle) * 1deg + 360deg)) translateY(calc(var(--radius) * 1px)) rotate(calc(var(--angle) * -1deg + -360deg))" },
        },
        "spring-in": {
          from: { opacity: "0", transform: "translateY(-8px) scale(0.96)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "slide-out-right": {
          from: { opacity: "1", transform: "translateX(0)" },
          to: { opacity: "0", transform: "translateX(100px)" },
        },
        "row-fill": {
          from: { opacity: "0.8", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        move: "move 5s linear infinite",
        orbit: "orbit calc(var(--duration) * 1s) linear infinite",
        "spring-in": "spring-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        "slide-out-right": "slide-out-right 150ms ease-out forwards",
        "row-fill": "row-fill 150ms ease-out",
      },

      /* =================================================================
         SHADOWS — Superhuman minimal shadow policy
         Only shadow-sm for floating, shadow-md for modals.
         No shadow-lg, shadow-xl, shadow-2xl.
         ================================================================= */
      boxShadow: {
        "card-hover": "0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        "panel":      "0 1px 2px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    tailwindScrollbarHide,
  ],
};

module.exports = config;
