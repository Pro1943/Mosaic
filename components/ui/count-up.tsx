'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, useInView } from 'motion/react'

type CountUpProps = {
  from?: number
  to: number
  separator?: string
  direction?: 'up' | 'down'
  duration?: number
  className?: string
  delay?: number
}

export function CountUp({
  from = 0,
  to,
  separator = ',',
  direction = 'up',
  duration = 1,
  className = '',
  delay = 0,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const [value, setValue] = useState(direction === 'down' ? to : from)

  useEffect(() => {
    if (!isInView) return

    const startValue = direction === 'down' ? to : from
    const endValue = direction === 'down' ? from : to

    const timeout = setTimeout(() => {
      const controls = animate(startValue, endValue, {
        duration,
        ease: 'easeOut',
        onUpdate(latest) {
          setValue(Math.round(latest))
        },
      })

      return () => controls.stop()
    }, delay * 1000)

    return () => clearTimeout(timeout)
  }, [from, to, direction, duration, delay, isInView])

  const formattedValue = value.toLocaleString('en-US').replace(/,/g, separator)

  return (
    <span ref={ref} className={className}>
      {formattedValue}
    </span>
  )
}

export default CountUp
