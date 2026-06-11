import { useState } from 'react'

// Footer dock over the 3D canvas (desktop shell). Carries the compact nav
// that used to live in the bottom ribbon / sidebar: tools, share, save, and
// the Pro chip. Drafting-toolbar look — flat graphite, hairline border,
// mono shortcut chips, red-pen accent for active states.

const DOCK_TOOLS = [
  {
    id: 'land',
    label: 'Land',
    shortcut: 'L',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
    ),
  },
  {
    id: 'build',
    label: 'Build',
    shortcut: 'B',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
    ),
  },
  {
    id: 'compare',
    label: 'Compare',
    shortcut: 'C',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    ),
  },
  {
    id: 'export',
    label: 'Export',
    shortcut: 'P',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    ),
  },
]

export default function CanvasDock({
  activePanel,
  onTogglePanel,
  onShare,
  onSave,
  saveState,
  canEdit,
  onEditLand,
  isDefiningLand,
  isPaidUser,
  onUpgrade,
  user,
  onSignIn,
  onSignOut,
  onOpenProjects,
}) {
  const [showProfile, setShowProfile] = useState(false)
  return (
    <div className="pointer-events-none fixed bottom-4 right-0 z-50 hidden justify-center lg:flex" style={{ left: 'var(--sidebar-w)' }}>
      <div className="canvas-dock pointer-events-auto flex items-stretch gap-0.5 rounded-xl p-1.5">
        {canEdit && (
          <>
            <button
              onClick={onEditLand}
              title="Edit land boundary"
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                isDefiningLand
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
              Edit land
            </button>
            <span className="my-1.5 w-px bg-[var(--color-border)]" />
          </>
        )}
        {DOCK_TOOLS.map(tool => (
          <button
            key={tool.id}
            onClick={() => onTogglePanel(tool.id)}
            disabled={!canEdit && tool.id === 'land'}
            title={`${tool.label} (${tool.shortcut})`}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              activePanel === tool.id
                ? 'bg-white/[0.08] text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]'
            } ${!canEdit && tool.id === 'land' ? 'opacity-40' : ''}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              {tool.icon}
            </svg>
            {tool.label}
            <kbd className="font-mono-data rounded border border-[var(--color-border)] bg-white/[0.04] px-1 text-[10px] leading-4 text-[var(--color-text-muted)]">
              {tool.shortcut}
            </kbd>
          </button>
        ))}
        <button
          onClick={onShare}
          title="Share"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
          Share
        </button>
        <div className="relative flex">
          <button
            onClick={() => setShowProfile(v => !v)}
            title={user ? user.email : 'Sign in'}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              showProfile ? 'bg-white/[0.08] text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-bg-elevated)] text-[10px] font-semibold">
              {user?.email?.charAt(0)?.toUpperCase() || (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              )}
            </span>
            Profile
          </button>
          {showProfile && (
            <div className="absolute bottom-full right-0 mb-2 w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1.5 shadow-xl">
              <div className="border-b border-[var(--color-border)] px-3 pb-2 pt-1.5">
                <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">{user ? user.email : 'Not signed in'}</p>
                <p className="font-mono-data text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{user ? (isPaidUser ? 'Pro plan' : 'Free plan') : 'Guest'}</p>
              </div>
              <div className="pt-1">
                <button
                  onClick={() => { onOpenProjects(); setShowProfile(false) }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]"
                >
                  Projects
                </button>
                {!isPaidUser && (
                  <button
                    onClick={() => { onUpgrade(); setShowProfile(false) }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]"
                  >
                    Upgrade to Pro
                  </button>
                )}
                {user ? (
                  <button
                    onClick={() => { onSignOut(); setShowProfile(false) }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs text-[var(--color-danger)] transition-colors hover:bg-white/[0.06]"
                  >
                    Sign out
                  </button>
                ) : (
                  <button
                    onClick={() => { onSignIn(); setShowProfile(false) }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs text-[var(--color-accent)] transition-colors hover:bg-white/[0.06]"
                  >
                    Sign in
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <span className="my-1.5 w-px bg-[var(--color-border)]" />
        <button
          onClick={onSave}
          disabled={!canEdit}
          title={saveState === 'saved' ? 'Saved' : 'Save your design'}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            saveState === 'saved'
              ? 'text-[var(--color-success)]'
              : saveState === 'saving'
                ? 'text-[var(--color-warning)]'
                : 'text-[var(--color-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]'
          } ${!canEdit ? 'opacity-40' : ''}`}
        >
          {saveState === 'saving' ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-warning)] border-t-transparent" />
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              {saveState === 'saved'
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />}
            </svg>
          )}
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save'}
        </button>
        {!isPaidUser && (
          <button
            onClick={onUpgrade}
            title="Upgrade to Pro"
            className="ml-0.5 flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" />
            </svg>
            Pro
          </button>
        )}
      </div>
    </div>
  )
}
