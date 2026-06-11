import { useMemo, useRef, useState } from 'react'
import AIChatPanel from './AIChatPanel'

// Desktop cockpit sidebar — the agent chat owns the whole column.
// Navigation lives in the CanvasDock footer over the scene. Drafting-graphite
// language: hairline rules, mono data, one red-pen accent.

export default function AgentSidebar({
  aiChat,
  projectName,
  areaLabel,
  onOpenProjects,
  onRenameProject,
  onCollapse,
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const nameInputRef = useRef(null)

  const promptHistory = useMemo(() => {
    const prompts = (aiChat.messages || [])
      .filter(m => m.role === 'user')
      .map(m => (m.displayText || (typeof m.content === 'string' ? m.content : '')).trim())
      .filter(Boolean)
    return [...new Set(prompts.reverse())].slice(0, 20)
  }, [aiChat.messages])

  const startEditing = () => {
    setNameDraft(projectName || 'Untitled site')
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.select(), 0)
  }

  const commitName = () => {
    const next = nameDraft.trim()
    if (next && next !== projectName) onRenameProject?.(next)
    setEditingName(false)
  }

  const fillComposer = (prompt) => {
    window.dispatchEvent(new CustomEvent('sitea:fill-composer', { detail: { text: prompt } }))
    setShowHistory(false)
  }

  return (
    <aside className="agent-sidebar fixed left-0 top-0 bottom-0 z-[60] hidden w-[380px] flex-col lg:flex">
      {/* Header */}
      <div className="relative shrink-0 border-b border-[var(--color-border)] px-4 pb-3 pt-3.5">
        <div className="flex items-center justify-between">
          <span className="font-display text-[13px] font-extrabold uppercase tracking-[0.24em] text-[var(--color-text-primary)]">
            Sitea
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistory(v => !v)}
              title="Prompt history"
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                showHistory ? 'bg-white/[0.08] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={aiChat.clearChat}
              title="Clear chat"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
            <button
              onClick={onCollapse}
              title="Close panel"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5a1.5 1.5 0 011.5 1.5v10.5a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V6.75a1.5 1.5 0 011.5-1.5zM9 5.25v13.5M5.25 9.75L7.5 12l-2.25 2.25" />
              </svg>
            </button>
          </div>
        </div>

        {/* Project name (editable) + area */}
        <div className="mt-2.5 flex items-end justify-between gap-3">
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => {
                e.stopPropagation()
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') setEditingName(false)
              }}
              className="min-w-0 flex-1 rounded-md border border-[var(--color-accent)]/50 bg-transparent px-1.5 py-0.5 font-display text-lg font-bold text-[var(--color-text-primary)] outline-none"
            />
          ) : (
            <button
              onClick={startEditing}
              title="Rename project"
              className="group flex min-w-0 items-center gap-2 text-left"
            >
              <span className="truncate font-display text-lg font-bold leading-6 text-[var(--color-text-primary)]">
                {projectName || 'Untitled site'}
              </span>
              <svg className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </button>
          )}
          <button
            onClick={onOpenProjects}
            title="Projects"
            className="font-mono-data shrink-0 rounded-md px-1.5 py-0.5 text-base font-medium text-[var(--color-accent)] transition-colors hover:bg-white/[0.05]"
          >
            {areaLabel}
          </button>
        </div>

        {/* History popover */}
        {showHistory && (
          <div className="absolute left-3 right-3 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1.5 shadow-xl">
            {promptHistory.length === 0 ? (
              <p className="px-3 py-3 text-xs text-[var(--color-text-muted)]">No prompts yet — your past requests will appear here.</p>
            ) : (
              promptHistory.map((prompt, i) => (
                <button
                  key={`${prompt}-${i}`}
                  onClick={() => fillComposer(prompt)}
                  className="block w-full truncate rounded-lg px-3 py-2 text-left text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]"
                >
                  {prompt}
                </button>
              ))
            )}
          </div>
        )}
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
