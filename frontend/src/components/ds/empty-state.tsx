"use client";

import type * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  /** Pass any ReactNode — typically a <Button> */
  action?: React.ReactNode;
  className?: string;
}

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
};

const iconVariants: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

const floatVariants: Variants = {
  rest: { y: 0 },
  hover: {
    y: -3,
    transition: {
      duration: 1.8,
      repeat: Infinity,
      repeatType: "reverse",
      ease: "easeInOut",
    },
  },
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const prefersReduced = useReducedMotion();

  const animProps = prefersReduced
    ? {}
    : { variants: containerVariants, initial: "hidden", animate: "show" };

  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className
      )}
      {...animProps}
    >
      {icon ? (
        <motion.div
          variants={prefersReduced ? undefined : iconVariants}
          whileHover={prefersReduced ? undefined : "hover"}
          initial={prefersReduced ? undefined : "rest"}
          animate={prefersReduced ? undefined : "show"}
          className="mb-5 relative"
        >
          {/* Ambient glow */}
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl scale-150 pointer-events-none" />

          {/* Floating icon wrapper */}
          <motion.div
            variants={prefersReduced ? undefined : floatVariants}
            className={cn(
              "relative flex items-center justify-center",
              "size-14 rounded-2xl",
              "bg-primary/10",
              "[&_svg]:size-6 text-primary"
            )}
          >
            {icon}
          </motion.div>

        </motion.div>
      ) : null}

      <motion.p
        variants={prefersReduced ? undefined : itemVariants}
        className="text-sm font-medium text-foreground tracking-[-0.01em]"
      >
        {title}
      </motion.p>

      <motion.p
        variants={prefersReduced ? undefined : itemVariants}
        className="mt-1.5 max-w-[260px] text-[13px] leading-relaxed text-muted-foreground"
      >
        {description}
      </motion.p>

      {action && (
        <motion.div
          variants={prefersReduced ? undefined : itemVariants}
          className="mt-4"
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
