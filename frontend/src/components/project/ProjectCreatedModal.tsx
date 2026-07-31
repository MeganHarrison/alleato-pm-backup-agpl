'use client'

import { motion, useReducedMotion, type Transition } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import NextImage from 'next/image'
import {
  Modal as Dialog,
  ModalContent as DialogContent,
  ModalTitle as DialogTitle,
} from '@/components/ui/unified-modal'
import { Button } from '@/components/ui/button'

interface ProjectCreatedModalProps {
  isOpen: boolean
  onClose: () => void
  onViewDashboard: () => void
  projectId: string
  projectName: string
}

export function ProjectCreatedModal({
  isOpen,
  onClose,
  onViewDashboard,
  projectName,
}: ProjectCreatedModalProps) {
  const prefersReducedMotion = useReducedMotion()

  // Stamp drop: falls from above, thuds down with a slight compression on impact
  const stampAnimation = prefersReducedMotion
    ? { opacity: 1, y: 0, rotate: -4, scale: 1 }
    : {
        opacity: [0, 1, 1, 1],
        y: [-55, 0, 5, 0],
        rotate: [-4, -4, -4.8, -4],
        scale: [1, 1, 0.96, 1],
      }

  const stampTransition: Transition = prefersReducedMotion
    ? { duration: 0 }
    : {
        delay: 0.25,
        duration: 0.55,
        times: [0, 0.62, 0.82, 1],
        ease: ['easeIn', 'easeOut', 'easeInOut', 'easeOut'],
      }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* eslint-disable-next-line design-system/no-design-violations -- DialogContent is a card-like component with intentional border */}
      <DialogContent size="xl" className="p-0 overflow-hidden bg-card rounded-2xl shadow-sm border-border">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          {/* Blueprint grid — runs through the full modal as a unifying texture */}
          <div
            className="absolute inset-0 opacity-[0.025] pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative px-12 pt-14 pb-12 text-center">
            {/* Stamp — the hero */}
            <div className="mb-8 flex justify-center">
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: -55, rotate: -4 }}
                animate={stampAnimation}
                transition={stampTransition}
                className="relative select-none pointer-events-none"
              >
                <NextImage
                  src="/images/issued-stamp.png"
                  alt="Issued for Construction"
                  width={520}
                  height={260}
                  priority
                  className="max-w-full h-auto"
                  style={{ width: '420px', mixBlendMode: 'multiply' }}
                />
              </motion.div>
            </div>

            <DialogTitle asChild>
              <motion.h2
                initial={prefersReducedMotion ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.3 }}
                className="text-5xl font-semibold text-foreground tracking-tight mb-3"
              >
                {projectName}
              </motion.h2>
            </DialogTitle>

            <motion.p
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.3 }}
              className="text-base text-muted-foreground mb-10"
            >
              Project created. Let&apos;s build something great.
            </motion.p>

            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.3 }}
              className="flex justify-center"
            >
              <Button
                onClick={onViewDashboard}
                size="lg"
                className="gap-1.5 group h-12 px-8 text-base"
              >
                View Project
                <ArrowRight className="group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
