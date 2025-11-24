import { Variants } from "framer-motion";

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.05, staggerDirection: -1 },
  },
};

export const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
  exit: { y: -20, opacity: 0 },
};

export const tabContentVariants: Variants = {
  initial: { opacity: 0, x: 10 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
  exit: { opacity: 0, x: -10, transition: { duration: 0.3, ease: "easeIn" } },
};

