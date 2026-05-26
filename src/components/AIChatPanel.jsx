import { useState, useRef, useEffect } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { fileToImageData } from '../utils/pdfToImage'

const SUGGESTIONS = [
  { label: 'Upload scanned PDF or plan image', action: 'upload' },
  { label: 'What can fit on my land?', prompt: 'What can fit on my land?' },
  { label: 'Create a simple 2-bedroom layout', prompt: 'Create a simple 2-bedroom layout' },
  { label: 'Summarize my current scene', prompt: "What's in my scene?" },
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

export default function AIChatPanel({ messages, isLoading, onSend, onClear, onClose }) {
  const isMobile = useIsMobile()
  const [input, setInput] = useState('')
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset for re-upload

    try {
      const { imageData } = await fileToImageData(file)
      const base64 = imageData.split(',')[1] // strip data:...;base64,
      onSend(input.trim() || '', base64)
      setInput('')
    } catch (err) {
      console.error('File render failed:', err)
      alert('Could not read this file. Please try a clearer PDF, PNG, or JPG.')
    }
  }

  const panel = (
    <div className={`flex flex-col bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-white ${
      isMobile
        ? 'fixed inset-x-0 bottom-0 z-50 rounded-t-2xl h-[80vh] safe-area-bottom'
        : 'fixed right-6 bottom-6 z-50 rounded-2xl w-[400px] max-h-[600px] shadow-2xl'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] shrink-0" style={{ padding: '16px 20px' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/20 flex items-center justify-center shrink-0">
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
            className="p-2.5 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 transition-all"
            title="Clear chat"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-2.5 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 transition-all"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-3 min-h-0" style={{ padding: '20px 20px' }}>
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20" style={{ padding: '18px' }}>
              <div className="font-display font-semibold text-white text-base mb-2">Start with your land or plan</div>
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                Ask what can fit, build rooms by size, or upload a scanned floor plan so Sitea can detect walls, doors, windows, and rooms.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.label}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="min-h-[48px] rounded-xl bg-white/5 hover:bg-white/10 text-sm text-left text-[var(--color-text-secondary)] hover:text-white transition-all border border-[var(--color-border)] flex items-center gap-3"
                  style={{ padding: '12px 16px' }}
                >
                  <SuggestionIcon action={suggestion.action} />
                  <span>{suggestion.label}</span>
                </button>
              ))}
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
                    {msg.toolActions && msg.toolActions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.toolActions.map((a, j) => <ToolChip key={j} action={a} />)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 rounded-2xl">
              <LoadingDots />
            </div>
          </div>
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
        <div className="flex items-center gap-2 bg-[var(--color-bg-elevated)] rounded-xl" style={{ padding: '12px 12px 12px 12px' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 transition-all shrink-0 disabled:opacity-30"
            title="Upload floor plan PDF or image"
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
            className="flex-1 bg-transparent text-sm text-white placeholder-[var(--color-text-muted)] outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] disabled:opacity-30 hover:bg-[var(--color-accent-hover)] transition-all shrink-0"
            style={{ padding: '12px' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )

  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        {panel}
      </>
    )
  }

  return panel
}
