import AIChatPanel from './AIChatPanel'

// Desktop "cockpit" sidebar, flat-neutral style: logo row, project pill,
// compact nav list with shortcut chips, the agent chat as the primary
// surface, and quiet cards/footer at the bottom. Rendered lg+ only; the
// mobile shell keeps the ribbon + floating chat.

const NAV_TOOLS = [
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
  {
    id: 'share',
    label: 'Share',
    shortcut: null,
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
    ),
  },
]

export default function AgentSidebar({
  aiChat,
  projectName,
  areaLabel,
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
  onOpenProjects,
  userInitial,
}) {
  return (
    <aside className="agent-sidebar fixed left-0 top-0 bottom-0 z-[60] hidden w-[380px] flex-col lg:flex">
      {/* Logo row */}
      <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]/15">
          <svg className="h-4 w-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <button
          onClick={aiChat.clearChat}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-white"
          title="Clear chat"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      {/* Project pill */}
      <div className="shrink-0 px-3 pb-2">
        <button
          onClick={onOpenProjects}
          className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--color-accent)] text-[11px] font-bold text-black">
            {(projectName || 'Sitea').charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-white">{projectName || 'Untitled site'}</span>
            <span className="block font-mono text-[11px] text-[var(--color-text-muted)]">{areaLabel}</span>
          </span>
          <svg className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>

      {/* Nav list */}
      <nav className="shrink-0 px-3 pb-1">
        {canEdit && (
          <button
            onClick={onEditLand}
            className={`flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
              isDefiningLand
                ? 'bg-white/[0.08] font-medium text-white'
                : 'text-[var(--color-text-secondary)] hover:bg-white/[0.05] hover:text-white'
            }`}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
            Edit land
          </button>
        )}
        {NAV_TOOLS.map(tool => (
          <button
            key={tool.id}
            onClick={() => (tool.id === 'share' ? onShare() : onTogglePanel(tool.id))}
            disabled={!canEdit && tool.id === 'land'}
            className={`flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
              activePanel === tool.id
                ? 'bg-white/[0.08] font-medium text-white'
                : 'text-[var(--color-text-secondary)] hover:bg-white/[0.05] hover:text-white'
            } ${!canEdit && tool.id === 'land' ? 'opacity-40' : ''}`}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              {tool.icon}
            </svg>
            <span className="flex-1 text-left">{tool.label}</span>
            {tool.shortcut && (
              <kbd className="rounded-md border border-white/[0.07] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">
                {tool.shortcut}
              </kbd>
            )}
          </button>
        ))}
      </nav>

      <div className="mx-4 shrink-0 border-t border-white/[0.06]" />

      {/* Agent chat — the primary surface */}
      <div className="flex min-h-0 flex-1 flex-col">
        <AIChatPanel
          variant="docked"
          messages={aiChat.messages}
          isLoading={aiChat.isLoading}
          activeProcess={aiChat.activeProcess}
          error={aiChat.error}
          onSend={aiChat.sendMessage}
          onAction={aiChat.handleAction}
          onClear={aiChat.clearChat}
          onClose={() => {}}
        />
      </div>

      {/* Bottom cards + footer */}
      <div className="shrink-0 px-3 pb-3 pt-1.5">
        {!isPaidUser && (
          <button
            onClick={onUpgrade}
            className="mb-2 flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3 text-left transition-colors hover:bg-white/[0.06]"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-white">Upgrade to Pro</span>
              <span className="block text-[11px] text-[var(--color-text-muted)]">Unlimited plan uploads & exports</span>
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" />
              </svg>
            </span>
          </button>
        )}
        <div className="flex items-center justify-between px-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-bg-elevated)] text-[11px] font-semibold text-[var(--color-text-secondary)]">
            {userInitial || 'S'}
          </span>
          <button
            onClick={onSave}
            disabled={!canEdit}
            title={saveState === 'saved' ? 'Saved' : 'Save your design'}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
              saveState === 'saved'
                ? 'text-[var(--color-accent)]'
                : saveState === 'saving'
                  ? 'text-amber-300'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-white'
            } ${!canEdit ? 'opacity-40' : ''}`}
          >
            {saveState === 'saving' ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                {saveState === 'saved'
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />}
              </svg>
            )}
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </aside>
  )
}
