import { useState, useEffect } from 'react'

// A phone in landscape has width > 768 but height < 500.
// We treat that as "mobile" so the mobile UI still applies.
const checkMobile = (breakpoint) =>
  window.innerWidth < breakpoint || (window.innerHeight < 500 && window.innerWidth > window.innerHeight)

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(checkMobile(breakpoint))

  useEffect(() => {
    const check = () => setIsMobile(checkMobile(breakpoint))
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [breakpoint])

  return isMobile
}

export function useIsLandscape() {
  const [isLandscape, setIsLandscape] = useState(
    window.innerHeight < 500 && window.innerWidth > window.innerHeight
  )

  useEffect(() => {
    const check = () => {
      setIsLandscape(window.innerHeight < 500 && window.innerWidth > window.innerHeight)
    }
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  return isLandscape
}
