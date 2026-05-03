import { useEffect, useRef } from 'react';

/**
 * useScrollFadeIn — IntersectionObserver-based fade-in hook.
 *
 * Usage:
 *   const ref = useScrollFadeIn();
 *   <section ref={ref} className="fade-in">…</section>
 *
 * Respects prefers-reduced-motion: those users see the element
 * immediately (.is-visible is added on mount).
 *
 * Pair with .fade-in or .fade-in-stagger CSS classes from theme.css.
 */
export function useScrollFadeIn({
  threshold = 0.18,
  rootMargin = '0px 0px -40px 0px',
  once = true,
} = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced-motion users: reveal immediately, no observer.
    const reduce = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      el.classList.add('is-visible');
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            if (once) obs.unobserve(entry.target);
          } else if (!once) {
            entry.target.classList.remove('is-visible');
          }
        }
      },
      { threshold, rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, rootMargin, once]);

  return ref;
}
