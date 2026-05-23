"use client";

import { useEffect, useState } from "react";
import { motion, type HTMLMotionProps, type Variants } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function useMotionReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: delay / 1000, ease: EASE },
  }),
};

export function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const motionReady = useMotionReady();

  if (!motionReady) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      custom={delay}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.12 }}
      variants={fadeUp}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MotionReveal({
  children,
  className,
  delay = 0,
  y = 16,
  x = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  x?: number;
}) {
  const motionReady = useMotionReady();

  if (!motionReady) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x, y }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.5, delay: delay / 1000, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function MotionButton({
  children,
  className,
  ...props
}: HTMLMotionProps<"button">) {
  return (
    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={className} {...props}>
      {children}
    </motion.button>
  );
}

export function FloatingIcon({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const motionReady = useMotionReady();

  if (!motionReady) {
    return (
      <span className={`pointer-events-none absolute select-none opacity-40 ${className ?? ""}`} aria-hidden>
        {children}
      </span>
    );
  }

  return (
    <motion.span
      className={`pointer-events-none absolute select-none ${className ?? ""}`}
      animate={{ y: [0, -10, 0], opacity: [0.35, 0.65, 0.35] }}
      transition={{ duration: 5 + delay, repeat: Infinity, ease: "easeInOut", delay }}
      aria-hidden
    >
      {children}
    </motion.span>
  );
}
