import AIChatPanel from './AIChatPanel'

// Desktop "site cockpit" sidebar: brand + project header, the agent chat as
// the primary surface, and a tool rail that replaces the bottom ribbon.
// Rendered only on large viewports; mobile keeps the ribbon + floating chat.

const TOOLS = [
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
  onSave,
  saveState,
  canEdit,
  onEditLand,
  isDefiningLand,
}) {
  return (
    <aside className="agent-sidebar fixed left-0 top-0 bottom-0 z-[60] hidden w-[380px] flex-col lg:flex">
      {/* Brand + project header */}
      <div className="shrink-0 border-b border-white/[0.07] px-5 pb-4 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 shadow-lg shadow-teal-950/40">
              <svg className="h-4.5 w-4.5 text-[var(--color-accent)]" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="font-display text-base font-bold leading-5 text-white">Sitea</div>
              <div className="truncate text-[11px] text-[var(--color-text-muted)]">{projectName || 'Untitled site'}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={aiChat.clearChat}
              className="sitea-icon-btn"
              title="Clear chat"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Area</span>
            <span className="font-mono text-sm font-semibold text-[var(--color-accent)]">{areaLabel}</span>
          </div>
          {canEdit && (
            <button
              onClick={onEditLand}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                isDefiningLand
                  ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                  : 'border-white/[0.07] text-[var(--color-text-secondary)] hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
              Edit land
            </button>
          )}
        </div>
      </div>

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

      {/* Tool rail */}
      <div className="shrink-0 border-t border-white/[0.07] px-3 pb-3 pt-2.5">
        <div className="flex items-center justify-between gap-1">
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              onClick={() => onTogglePanel(tool.id)}
              disabled={!canEdit && tool.id === 'land'}
              title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 transition-all ${
                activePanel === tool.id
                  ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-white'
              } ${!canEdit && tool.id === 'land' ? 'opacity-40' : ''}`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                {tool.icon}
              </svg>
              <span className="text-[10px] font-semibold">{tool.label}</span>
            </button>
          ))}
          <button
            onClick={onSave}
            disabled={!canEdit}
            title={saveState === 'saved' ? 'Saved' : 'Save your design'}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 transition-all ${
              saveState === 'saved'
                ? 'text-[var(--color-accent)]'
                : saveState === 'saving'
                  ? 'text-amber-300'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-white'
            } ${!canEdit ? 'opacity-40' : ''}`}
          >
            {saveState === 'saving' ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
            ) : saveState === 'saved' ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
            )}
            <span className="text-[10px] font-semibold">{saveState === 'saving' ? 'Saving' : saveState === 'saved' ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
