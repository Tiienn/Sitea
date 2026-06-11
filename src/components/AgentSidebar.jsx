import AIChatPanel from './AIChatPanel'

// Desktop cockpit sidebar — the agent chat owns the whole column.
// Navigation lives in the CanvasDock footer over the scene. Drafting-graphite
// language: hairline rules, mono data, one red-pen accent.

export default function AgentSidebar({
  aiChat,
  projectName,
  areaLabel,
  onOpenProjects,
}) {
  return (
    <aside className="agent-sidebar fixed left-0 top-0 bottom-0 z-[60] hidden w-[380px] flex-col lg:flex">
      {/* Header strip */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-display text-sm font-extrabold uppercase tracking-[0.22em] text-[var(--color-text-primary)]">
            Sitea
          </span>
          <span className="h-4 w-px shrink-0 bg-[var(--color-border-hover)]" />
          <button
            onClick={onOpenProjects}
            className="group flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-white/[0.05]"
            title="Projects"
          >
            <span className="truncate text-xs text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]">
              {projectName || 'Untitled site'}
            </span>
            <span className="font-mono-data shrink-0 text-[11px] text-[var(--color-accent)]">{areaLabel}</span>
            <svg className="h-3 w-3 shrink-0 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>
        <button
          onClick={aiChat.clearChat}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]"
          title="Clear chat"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      {/* Agent chat — the entire panel */}
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
    </aside>
  )
}
