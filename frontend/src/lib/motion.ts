import type { Transition, Variants } from 'framer-motion';

/**
 * SMARTSCHED Motion Presets ("The Living Timetable")
 * Centralized springs, curves, and variants compatible with reduced-motion preferences.
 */

export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const SPRING_SNAPPY: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

export const SPRING_GENTLE: Transition = {
  type: 'spring',
  stiffness: 240,
  damping: 26,
  mass: 0.9,
};

export const TRANSITION_FAST: Transition = {
  duration: 0.18,
  ease: EASE_OUT_EXPO,
};

export const TRANSITION_BASE: Transition = {
  duration: 0.32,
  ease: EASE_OUT_EXPO,
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: TRANSITION_BASE,
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: SPRING_SNAPPY,
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.04,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: TRANSITION_BASE,
  },
};

export const slideInPanel: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: SPRING_GENTLE,
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: TRANSITION_FAST,
  },
};

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: TRANSITION_BASE,
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: TRANSITION_FAST,
  },
};
