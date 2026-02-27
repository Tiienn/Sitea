import { useState, useEffect, useRef } from 'react'
import { listProjects, renameProject, deleteProject } from '../services/projectService'

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export default function ProjectsModal({ onClose, onLoad, onNew, currentProjectId }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const modalRef = useRef(null)
  const didFocusRef = useRef(false)

  useEffect(() => {
    loadList()
  }, [])

  const loadList = async () => {
    setLoading(true)
    const result = await listProjects()
    if (!result.error) setProjects(result.data || [])
    setLoading(false)
  }

  const handleRename = async (id) => {
    if (!renameValue.trim()) return
    await renameProject(id, renameValue.trim())
    setRenamingId(null)
    loadList()
  }

  const handleDelete = async (id) => {
    await deleteProject(id)
    setDeletingId(null)
    loadList()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      tabIndex={-1}
      ref={el => { modalRef.current = el; if (el && !didFocusRef.current) { el.focus(); didFocusRef.current = true } }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[var(--color-panel)] backdrop-blur-xl rounded-2xl shadow-2xl border border-[var(--color-border)] animate-fade-in"
        style={{ width: '90vw', maxWidth: '480px', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)]" style={{ padding: '20px 24px 16px' }}>
          <h2 className="font-display font-bold text-white text-lg">My Projects</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New Project button */}
        <div style={{ padding: '16px 24px 8px' }}>
          <button
            onClick={() => { onNew(); onClose() }}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-bg-primary)] font-semibold text-sm transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Project
          </button>
        </div>

        {/* Project list */}
        <div className="overflow-y-auto" style={{ padding: '8px 24px 24px', maxHeight: 'calc(80vh - 160px)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[var(--color-text-secondary)] text-sm">No saved projects yet</p>
              <p className="text-[var(--color-text-muted)] text-xs mt-2">Save your design to access it anytime</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {projects.map(project => (
                <div
                  key={project.id}
                  className={`group rounded-xl border transition-all cursor-pointer ${
                    project.id === currentProjectId
                      ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5'
                      : 'border-[var(--color-border)] hover:border-white/15 hover:bg-white/5'
                  }`}
                  style={{ padding: '14px 16px' }}
                >
                  {/* Rename mode */}
                  {renamingId === project.id ? (
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <input
                        autoFocus
                        className="flex-1 bg-[var(--color-bg-elevated)] text-white text-sm rounded-lg px-3 py-2 border border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onMouseDown={e => e.stopPropagation()}
                        onKeyDown={e => {
                          e.stopPropagation()
                          if (e.key === 'Enter') handleRename(project.id)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                      />
                      <button
                        onClick={() => handleRename(project.id)}
                        className="px-3 py-2 text-xs font-medium bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-accent-hover)] transition-all"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:text-white transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : deletingId === project.id ? (
                    /* Delete confirm */
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-red-400">Delete this project?</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="px-3 py-1.5 text-xs font-medium bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-white transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal view */
                    <div onClick={() => { onLoad(project.id); onClose() }}>
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-white text-sm font-medium truncate">{project.name}</div>
                          <div className="text-[var(--color-text-muted)] text-xs mt-1">
                            Last edited {timeAgo(project.updated_at)}
                            {project.id === currentProjectId && (
                              <span className="ml-2 text-[var(--color-accent)]">Current</span>
                            )}
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setRenamingId(project.id)
                              setRenameValue(project.name)
                              setDeletingId(null)
                            }}
                            className="p-2 text-[var(--color-text-secondary)] hover:text-white transition-colors rounded-lg hover:bg-white/10"
                            title="Rename"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setDeletingId(project.id)
                              setRenamingId(null)
                            }}
                            className="p-2 text-[var(--color-text-secondary)] hover:text-red-400 transition-colors rounded-lg hover:bg-white/10"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
