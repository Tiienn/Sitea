import { useState, useCallback, useRef } from 'react'

const MAX_HISTORY_SIZE = 50

/**
 * Custom hook for undo/redo functionality
 * Manages a history stack of states with configurable max size
 */
export function useBuildHistory(initialState) {
  // History stack: array of past states
  const [history, setHistory] = useState([initialState])
  // Current position in history
  const [historyIndex, setHistoryIndex] = useState(0)

  // Use ref to avoid stale closure issues
  const historyRef = useRef(history)
  const indexRef = useRef(historyIndex)
  historyRef.current = history
  indexRef.current = historyIndex

  // Current state is whatever we're pointing at
  const currentState = history[historyIndex]

  // Can we undo/redo?
  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  // Push a new state (called after each action)
  const pushState = useCallback((newState) => {
    const currentHistory = historyRef.current
    const currentIndex = indexRef.current

    // Don't push if state is identical to current (shallow JSON compare)
    const currentStateJson = JSON.stringify(currentHistory[currentIndex])
    const newStateJson = JSON.stringify(newState)
    if (currentStateJson === newStateJson) {
      return // No change, don't push
    }

    // Remove any "future" states if we're not at the end
    // (user did undo, then made a new action)
    const newHistory = currentHistory.slice(0, currentIndex + 1)

    // Add new state
    newHistory.push(newState)

    // Trim if exceeding max size
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift() // Remove oldest
      setHistoryIndex(newHistory.length - 1)
    } else {
      setHistoryIndex(newHistory.length - 1)
    }

    setHistory(newHistory)
  }, [])

  // Undo: go back one step
  const undo = useCallback(() => {
    if (indexRef.current > 0) {
      setHistoryIndex(prev => prev - 1)
      return true
    }
    return false
  }, [])

  // Redo: go forward one step
  const redo = useCallback(() => {
    if (indexRef.current < historyRef.current.length - 1) {
      setHistoryIndex(prev => prev + 1)
      return true
    }
    return false
  }, [])

  // Clear history (e.g., when loading a new project)
  const clearHistory = useCallback((newInitialState) => {
    setHistory([newInitialState])
    setHistoryIndex(0)
  }, [])

  // Replace current state without adding to history (for real-time dragging)
  const replaceCurrentState = useCallback((newState) => {
    setHistory(prev => {
      const newHistory = [...prev]
      newHistory[indexRef.current] = newState
      return newHistory
    })
  }, [])

  return {
    currentState,
    pushState,
    replaceCurrentState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    historyLength: history.length,
    historyIndex,
  }
}
