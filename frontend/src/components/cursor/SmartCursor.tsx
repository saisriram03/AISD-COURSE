import { useEffect, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { type SmartCursorState, useCursorStore } from '@/store/useCursorStore';

const CURSOR_SIZES: Record<SmartCursorState, number> = {
  default: 18,
  link: 34,
  button: 38,
  'grid-cell': 28,
  drag: 32,
  solving: 42,
  success: 34,
  danger: 34,
  text: 24,
};

const CURSOR_COLORS: Record<SmartCursorState, string> = {
  default: 'var(--accent-violet)',
  link: 'var(--accent-cyan)',
  button: 'var(--accent-violet)',
  'grid-cell': 'var(--accent-cyan)',
  drag: 'var(--accent-amber)',
  solving: 'var(--accent-violet)',
  success: 'var(--accent-mint)',
  danger: 'var(--accent-coral)',
  text: 'var(--text-primary)',
};

function resolveStateFromTarget(target: EventTarget | null): {
  state: SmartCursorState;
  label: string | null;
} {
  if (!(target instanceof HTMLElement)) {
    return { state: 'default', label: null };
  }

  const explicit = target.closest<HTMLElement>('[data-cursor]');
  if (explicit) {
    const raw = explicit.dataset.cursor as SmartCursorState | undefined;
    const label = explicit.dataset.cursorLabel ?? null;
    if (raw && raw in CURSOR_SIZES) {
      return { state: raw, label };
    }
  }

  if (target.closest('input, textarea, [contenteditable="true"]')) {
    return { state: 'text', label: null };
  }
  if (target.closest('button, [role="button"]')) {
    return { state: 'button', label: null };
  }
  if (target.closest('a[href]')) {
    return { state: 'link', label: null };
  }

  return { state: 'default', label: null };
}

/**
 * SmartCursor
 * Renders a GPU-accelerated contextual cursor on fine-pointer desktop devices.
 * Automatically disables itself on touch screens and when prefers-reduced-motion is enabled.
 * Never hides the native cursor unless actively mounted and enabled.
 */
export function SmartCursor() {
  const prefersReducedMotion = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);

  const cursorState = useCursorStore((s) => s.cursorState);
  const label = useCursorStore((s) => s.label);
  const setCursorState = useCursorStore((s) => s.setCursorState);

  const pointerX = useMotionValue(-100);
  const pointerY = useMotionValue(-100);

  const springX = useSpring(pointerX, { stiffness: 520, damping: 38, mass: 0.35 });
  const springY = useSpring(pointerY, { stiffness: 520, damping: 38, mass: 0.35 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pointerQuery = window.matchMedia('(pointer: fine) and (hover: hover)');

    const syncAvailability = () => {
      const canActivate = pointerQuery.matches && !prefersReducedMotion;
      setEnabled(canActivate);
      if (canActivate) {
        document.documentElement.setAttribute('data-smart-cursor', 'active');
      } else {
        document.documentElement.removeAttribute('data-smart-cursor');
      }
    };

    syncAvailability();
    pointerQuery.addEventListener('change', syncAvailability);

    return () => {
      pointerQuery.removeEventListener('change', syncAvailability);
      document.documentElement.removeAttribute('data-smart-cursor');
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!enabled) return;

    const handleMove = (event: PointerEvent) => {
      pointerX.set(event.clientX);
      pointerY.set(event.clientY);
      if (!visible) setVisible(true);

      const resolved = resolveStateFromTarget(event.target);
      setCursorState(resolved.state, resolved.label);
    };

    const handleDown = () => setPressed(true);
    const handleUp = () => setPressed(false);
    const handleLeave = () => setVisible(false);
    const handleEnter = () => setVisible(true);

    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerdown', handleDown);
    window.addEventListener('pointerup', handleUp);
    document.addEventListener('mouseleave', handleLeave);
    document.addEventListener('mouseenter', handleEnter);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerdown', handleDown);
      window.removeEventListener('pointerup', handleUp);
      document.removeEventListener('mouseleave', handleLeave);
      document.removeEventListener('mouseenter', handleEnter);
    };
  }, [enabled, pointerX, pointerY, setCursorState, visible]);

  if (!enabled || !visible) {
    return null;
  }

  const size = CURSOR_SIZES[cursorState];
  const color = CURSOR_COLORS[cursorState];
  const isText = cursorState === 'text';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 'var(--z-cursor)' }}
    >
      {/* Precision center dot */}
      <motion.div
        style={{ x: pointerX, y: pointerY }}
        className="fixed top-0 left-0 -translate-x-1/2 -translate-y-1/2"
      >
        <div
          className={isText ? 'h-5 w-0.5 rounded-full' : 'h-1.5 w-1.5 rounded-full'}
          style={{ backgroundColor: color }}
        />
      </motion.div>

      {/* Outer contextual ring */}
      <motion.div
        animate={{
          width: isText ? 4 : pressed ? size * 0.82 : size,
          height: isText ? 24 : pressed ? size * 0.82 : size,
          borderRadius: isText ? 4 : cursorState === 'grid-cell' ? 6 : 9999,
          rotate: cursorState === 'solving' ? 360 : 0,
          opacity: isText ? 0.35 : 0.9,
        }}
        transition={
          cursorState === 'solving'
            ? {
                rotate: { repeat: Infinity, duration: 1.4, ease: 'linear' },
                width: { duration: 0.16 },
                height: { duration: 0.16 },
              }
            : { type: 'spring', stiffness: 460, damping: 30 }
        }
        className="fixed top-0 left-0 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center border-[1.5px]"
        style={{
          x: springX,
          y: springY,
          borderColor: color,
          borderStyle: cursorState === 'solving' ? 'dashed' : 'solid',
          backgroundColor:
            cursorState === 'drag'
              ? 'rgba(255, 181, 71, 0.14)'
              : cursorState === 'danger'
                ? 'rgba(255, 77, 106, 0.12)'
                : cursorState === 'success'
                  ? 'rgba(61, 255, 176, 0.12)'
                  : 'transparent',
        }}
      >
        {label && (
          <span
            className="absolute top-full mt-2 whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium text-white shadow-sm"
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
          >
            {label}
          </span>
        )}
      </motion.div>
    </div>
  );
}
