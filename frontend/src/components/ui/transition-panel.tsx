"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Transition, Variants } from "motion/react";

export interface TransitionPanelProps {
  activeIndex: number;
  transition?: Transition;
  variants?: Variants;
  children: React.ReactNode[];
  className?: string;
}

export function TransitionPanel({
  activeIndex,
  transition,
  variants,
  children,
  className,
}: TransitionPanelProps) {
  const childrenArray = React.Children.toArray(children);

  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          initial="enter"
          animate="center"
          exit="exit"
          variants={variants}
          transition={transition}
        >
          {childrenArray[activeIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
