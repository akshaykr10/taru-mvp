import { useEffect, useRef } from 'react'
import { logActivity } from '../lib/activity.js'

/**
 * Fires a single activity event when an element enters the viewport.
 *
 * @param {string}  actorType  'parent' | 'child'
 * @param {string}  eventType  from the event taxonomy
 * @param {object}  [opts]     forwarded to logActivity (authToken, childToken, section, metadata)
 * @param {number}  [dwellMs]  if set, event only fires after element stays visible for this many ms
 *                             (use 3000 for child_learn_card_viewed per CLAUDE.md)
 * @returns {React.RefObject}  attach to the element you want to observe
 */
export function useActivityOnView(actorType, eventType, opts = {}, dwellMs = 0) {
  const ref   = useRef(null)
  const fired = useRef(false)      // fire exactly once per mount
  const timer = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Don't set up observer if we can't fire (missing required auth)
    if (actorType === 'parent' && !opts.authToken)   return
    if (actorType === 'child'  && !opts.childToken)  return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (fired.current) return

        if (entry.isIntersecting) {
          if (dwellMs > 0) {
            // Start dwell timer — fire only if still visible after dwellMs
            timer.current = setTimeout(() => {
              if (!fired.current) {
                fired.current = true
                logActivity(actorType, eventType, opts)
              }
            }, dwellMs)
          } else {
            // Fire immediately on first intersection
            fired.current = true
            logActivity(actorType, eventType, opts)
          }
        } else {
          // Left viewport before dwell completed — cancel timer
          if (timer.current) {
            clearTimeout(timer.current)
            timer.current = null
          }
        }
      },
      { threshold: 0.5 }   // at least 50% visible before counting
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
      if (timer.current) clearTimeout(timer.current)
    }
  // opts intentionally excluded from deps — we capture the initial value only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorType, eventType, dwellMs])

  return ref
}
