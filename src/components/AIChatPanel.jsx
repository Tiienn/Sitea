import { useState, useRef, useEffect } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { fileToImageData } from '../utils/pdfToImage'

const SUGGESTIONS = [
  { label: 'Upload a plan', detail: 'Site plan, floor plan, PDF, PNG, or JPG', action: 'upload', tone: 'primary' },
  { label: 'See what fits', detail: 'Compare courts, homes, and setbacks', prompt: 'What can fit on my land?' },
  { label: 'Start with land size', detail: 'Enter dimensions or choose a plot size', prompt: 'Help me start with my land size.' },
]

function SuggestionIcon({ action }) {
  if (action === 'upload') {
    return (
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3 3m3-3l3 3M5.25 19.5h13.5A2.25 2.25 0 0021 17.25V6.75a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
      </svg>
    )
  }

  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  )
}

function ToolChip({ action }) {
  const getLabel = () => {
    const { name, input } = action
    switch (name) {
      case 'create_room': {
        const label = input.label || 'Room'
        return `${label} ${input.width}×${input.depth}m`
      }
      case 'add_furniture':
        return `Added ${input.catalogId}`
      case 'delete_furniture':
        return 'Removed furniture'
      case 'clear_scene':
        return 'Scene cleared'
      case 'get_scene_summary':
        return 'Scanned scene'
      case 'analyze_floor_plan':
        return `${input.wallCount || 0} walls detected`
      case 'review_site_plan':
        return 'Site plan reviewed'
      case 'handoff_to_scene':
        return 'Opened scene'
      case 'review_site_boundary':
        return 'Boundary review opened'
      case 'activate_comparison':
        return `Added ${input.objectName || 'comparison'}`
      case 'remove_comparison':
        return `Removed ${input.objectName || 'comparison'}`
      case 'replace_comparison':
        return `Replaced ${input.fromObjectName || 'object'}`
      case 'clear_comparisons':
        return 'Cleared comparisons'
      case 'reset_comparison_transform':
        return `Reset ${input.objectName || 'comparison'}`
      case 'reset_all_comparison_transforms':
        return 'Reset comparisons'
      case 'place_structure':
        return `Placed ${input.structureName || 'structure'}`
      case 'place_structure_layout':
        return `Placed ${input.placedCount || 0} structures`
      case 'offer_structure_layout_options':
        return 'Prepared layout options'
      case 'apply_structure_layout_option':
        return input.optionLabel ? `Used ${input.optionLabel}` : 'Used layout option'
      case 'explain_last_layout_change':
        return 'Explained layout'
      case 'compare_layout_options':
        return 'Compared layouts'
      case 'apply_latest_layout_recommendation':
        return 'Checked recommendation'
      case 'capture_project_goals':
        return 'Saved goals'
      case 'clarify_or_act':
        return input.mode === 'ask_for_priority' ? 'Asked priority' : 'Planned next action'
      case 'site_brief':
        return 'Prepared site brief'
      case 'summarize_scene':
        return 'Inspected scene'
      case 'recommend_next_step':
        return 'Recommended next move'
      case 'move_structure':
        return `Moved ${input.structureName || 'structure'}`
      case 'rotate_structure':
        return `Rotated ${input.structureName || 'structure'}`
      case 'resize_structure':
        return `Resized ${input.structureName || 'structure'}`
      case 'replace_structure':
        return `Replaced ${input.structureName || 'structure'}`
      case 'remove_structure':
        return `Removed ${input.structureName || 'structure'}`
      case 'clear_structures':
        return 'Cleared structures'
      case 'undo_agent_structure_change':
        return 'Undid layout'
      case 'retry_structure_layout':
        return `Tried ${input.placedCount || 0} structures`
      case 'set_land_dimensions':
        return `Set land ${input.length}×${input.width}m`
      case 'set_land_area':
        return `Set land ${input.area}m²`
      case 'set_demo_land':
        return 'Demo land set'
      case 'fit_check':
      case 'general_fit_check':
        return 'Checked fit'
      default:
        return name
    }
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg text-xs font-medium ${
      action.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
    }`} style={{ padding: '4px 10px' }}>
      {action.success ? '✓' : '✗'} {getLabel()}
    </span>
  )
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}

function GuidedSteps({ steps }) {
  if (!steps?.length) return null

  return (
    <div className="sitea-agent-steps">
      {steps.map((step, index) => {
        const state = step.state || 'waiting'
        return (
          <div key={`${step.label}-${index}`} className={`sitea-agent-step sitea-agent-step-${state}`}>
            <span className="sitea-agent-step-dot" aria-hidden="true">
              {state === 'done' ? '✓' : index + 1}
            </span>
            <span>{step.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function AgentProgress({ process }) {
  if (!process) return null

  return (
    <div className="flex justify-start">
      <div className="sitea-agent-progress rounded-2xl max-w-[92%]" style={{ padding: '16px 18px' }}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/12 border border-[var(--color-accent)]/25 text-[var(--color-accent)] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display font-semibold text-sm text-white">{process.title}</div>
            {process.subtitle && (
              <div className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">{process.subtitle}</div>
            )}
            <GuidedSteps steps={process.steps} />
          </div>
        </div>
      </div>
    </div>
  )
}

function DecisionCard({ decision }) {
  if (!decision) return null

  return (
    <div className="sitea-agent-decision-card">
      <div className="sitea-agent-decision-label">{decision.label || 'Recommended next move'}</div>
      <div className="sitea-agent-decision-title">{decision.title}</div>
      {decision.body && (
        <div className="sitea-agent-decision-body">{decision.body}</div>
      )}
      {decision.detail && (
        <div className="sitea-agent-decision-detail">{decision.detail}</div>
      )}
    </div>
  )
}

export default function AIChatPanel({ messages, isLoading, activeProcess, onSend, onAction, onClear, onClose }) {
  const isMobile = useIsMobile()
  const [input, setInput] = useState('')
  const [isDragActive, setIsDragActive] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const dragDepthRef = useRef(0)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current && (messages.length > 0 || isLoading)) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    onSend(input.trim())
    setInput('')
  }

  const handleSuggestion = (text) => {
    onSend(text)
  }

  const handleSuggestionClick = (suggestion) => {
    if (suggestion.action === 'upload') {
      fileInputRef.current?.click()
      return
    }
    handleSuggestion(suggestion.prompt)
  }

  const handleMessageAction = (action) => {
    if (isLoading) return
    if (action.action === 'upload') {
      fileInputRef.current?.click()
      return
    }
    if (action.prompt) {
      handleSuggestion(action.prompt)
      return
    }
    onAction?.(action)
  }

  const handlePlanFile = async (file) => {
    if (!file) return
    try {
      const { imageData } = await fileToImageData(file)
      const base64 = imageData.split(',')[1] // strip data:...;base64,
      onSend(input.trim() || `Analyze ${file.name}`, base64, { imageData, fileName: file.name })
      setInput('')
    } catch (err) {
      console.error('File render failed:', err)
      alert('Could not read this file. Please try a clearer PDF, PNG, or JPG.')
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset for re-upload
    handlePlanFile(file)
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (isLoading) return
    dragDepthRef.current += 1
    setIsDragActive(true)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDragActive(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = 0
    setIsDragActive(false)
    if (isLoading) return
    handlePlanFile(e.dataTransfer.files?.[0])
  }

  const panel = (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`sitea-agent-panel flex flex-col backdrop-blur-xl text-white ${
        isMobile
          ? 'fixed left-3 right-3 bottom-24 z-[220] rounded-2xl h-[64vh] max-h-[620px] safe-area-bottom'
          : 'fixed right-6 bottom-6 z-50 rounded-2xl w-[400px] max-h-[600px]'
      }`}>
      {isDragActive && (
        <div className="absolute inset-3 z-10 rounded-2xl border border-[var(--color-accent)] bg-[var(--color-bg-primary)]/85 backdrop-blur-md flex flex-col items-center justify-center text-center pointer-events-none" style={{ padding: '24px' }}>
          <div className="w-11 h-11 rounded-xl bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/25 text-[var(--color-accent)] flex items-center justify-center mb-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3 3m3-3l3 3M5.25 19.5h13.5A2.25 2.25 0 0021 17.25V6.75a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div className="font-display font-semibold text-white text-base mb-1">Drop your plan here</div>
          <div className="text-sm text-[var(--color-text-secondary)]">Sitea Agent will scan it and prepare a 3D building preview.</div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] shrink-0" style={{ padding: '16px 20px' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/25 flex items-center justify-center shrink-0 shadow-lg shadow-teal-950/30">
            <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <div>
            <div className="font-display font-semibold text-sm">Sitea Agent</div>
            <div className="text-[11px] text-[var(--color-text-muted)]">Land, plans, rooms, exports</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            className="sitea-icon-btn"
            title="Clear chat"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="sitea-icon-btn"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="sitea-agent-scroll flex-1 overflow-y-auto space-y-3 min-h-0" style={{ padding: '20px 20px' }}>
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20" style={{ padding: '18px' }}>
              <div className="font-display font-semibold text-white text-base mb-2">How can we help you?</div>
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                Upload a plan or ask what fits. Sitea will turn it into clear next steps on the land.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((suggestion) => {
                const isPrimary = suggestion.tone === 'primary'
                return (
                  <button
                    key={suggestion.label}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`sitea-agent-action ${isPrimary ? 'sitea-agent-action-primary' : ''} text-left flex items-center gap-3`}
                  >
                    <SuggestionIcon action={suggestion.action} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white">{suggestion.label}</span>
                      <span className="block text-xs leading-relaxed text-[var(--color-text-secondary)]">{suggestion.detail}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          // Get display text for user messages (may be multimodal)
          const displayText = msg.role === 'user'
            ? (msg.displayText ?? (typeof msg.content === 'string' ? msg.content : ''))
            : msg.content
          return (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div style={{ padding: '10px 18px' }} className={`max-w-[85%] rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                  : msg.error
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-white/5 text-[var(--color-text-primary)]'
              }`}>
                {msg.error ? (
                  <p>{msg.error}</p>
                ) : (
                  <>
                    {msg.hasImage && (
                      <div className="flex items-center gap-1.5 mb-1.5 text-xs opacity-75">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25a1.5 1.5 0 001.5 1.5z" />
                        </svg>
                        Plan attached
                      </div>
                    )}
                    {displayText && <p className="whitespace-pre-wrap">{displayText}</p>}
                    {msg.decision && <DecisionCard decision={msg.decision} />}
                    {msg.toolActions && msg.toolActions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.toolActions.map((a, j) => <ToolChip key={j} action={a} />)}
                      </div>
                    )}
                    {msg.nextSteps && (
                      <GuidedSteps steps={msg.nextSteps} />
                    )}
                    {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2">
                        {msg.suggestedActions.map((action, j) => (
                          <button
                            key={`${action.label}-${j}`}
                            type="button"
                            onClick={() => handleMessageAction(action)}
                            disabled={isLoading}
                            className="sitea-agent-action sitea-agent-action-primary text-sm font-semibold text-left flex items-center gap-2"
                            style={{ minHeight: '44px', padding: '10px 16px' }}
                          >
                            <svg className="w-4 h-4 shrink-0 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                            <span>{action.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}

        {isLoading && (
          activeProcess ? <AgentProgress process={activeProcess} /> : (
            <div className="flex justify-start">
              <div className="bg-white/5 rounded-2xl">
                <LoadingDots />
              </div>
            </div>
          )
        )}
      </div>

      {/* Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,.pdf"
        onChange={handleFileUpload}
        className="hidden"
      />
      <form onSubmit={handleSubmit} className="shrink-0 border-t border-[var(--color-border)]" style={{ padding: '12px 20px 20px' }}>
        <div className="sitea-agent-input-shell flex items-center gap-2 rounded-xl" style={{ padding: '12px' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="sitea-icon-btn shrink-0"
            title="Upload site plan, floor plan PDF, or image"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25a1.5 1.5 0 001.5 1.5z" />
            </svg>
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
              placeholder="Ask Sitea or upload a plan..."
              disabled={isLoading}
              className="flex-1 min-h-[44px] bg-transparent text-sm text-white placeholder-[var(--color-text-muted)] outline-none"
            />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="sitea-icon-btn sitea-icon-btn-primary shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )

  return panel
}
