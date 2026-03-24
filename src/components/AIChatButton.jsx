import { useIsMobile } from '../hooks/useIsMobile'

export default function AIChatButton({ onClick, visible }) {
  const isMobile = useIsMobile()

  return (
    <button
      onClick={onClick}
      className={`fixed z-[60] flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-bg-primary)] shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:scale-105 active:scale-95 transition-all duration-200 ${
        isMobile ? 'bottom-20 right-4' : 'right-5 bottom-[260px]'
      } ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      aria-label="Open AI Assistant"
    >
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    </button>
  )
}
