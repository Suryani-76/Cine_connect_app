import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { Check, AlertCircle } from 'lucide-react'
import { vocabApi, VocabItem } from '../lib/api'
import { DepartmentMark } from './ui/DepartmentMark'

interface AutocompleteInputProps {
  id?: string
  name?: string
  label?: string
  value: string
  onChange: (value: string) => void
  type: 'roles' | 'cities'
  placeholder?: string
  required?: boolean
  autoFocus?: boolean
  error?: string
  className?: string
}

export function AutocompleteInput({
  id,
  name,
  label,
  value,
  onChange,
  type,
  placeholder,
  required,
  autoFocus,
  error,
  className = '',
}: AutocompleteInputProps) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<VocabItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync external value
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Debounced fetch
  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const fetcher = type === 'roles' ? vocabApi.roles : vocabApi.cities
        const res = await fetcher(query)
        if (active) {
          const list = (type === 'roles' ? (res as { roles: VocabItem[] }).roles : (res as { cities: VocabItem[] }).cities) || []
          setSuggestions(list)
          setSelectedIndex(-1)
        }
      } catch {
        if (active) setSuggestions([])
      } finally {
        if (active) setLoading(false)
      }
    }, 150)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, type, isOpen])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (item: VocabItem) => {
    setQuery(item.name)
    onChange(item.name)
    setIsOpen(false)
  }

  const handleUseCustom = () => {
    const trimmed = query.trim()
    if (trimmed) {
      onChange(trimmed)
      setIsOpen(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelect(suggestions[selectedIndex])
      } else {
        handleUseCustom()
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const isExactVerified = suggestions.some(
    s => s.name.toLowerCase() === query.trim().toLowerCase()
  )

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={id} className="text-12 font-semibold text-muted block">
            {label} {required && <span className="text-status-error">*</span>}
          </label>
          {query.trim() && (
            <span className="text-11 font-normal">
              {isExactVerified ? (
                <span className="text-status-success inline-flex items-center gap-0.5">
                  <Check size={11} /> Verified term
                </span>
              ) : (
                <span className="text-status-warning inline-flex items-center gap-0.5">
                  <AlertCircle size={11} /> Custom (unverified)
                </span>
              )}
            </span>
          )}
        </div>
      )}

      <div className="relative">
        <input
          id={id}
          name={name}
          type="text"
          autoFocus={autoFocus}
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            onChange(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={error ? 'input-error' : 'input'}
          autoComplete="off"
        />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-surface-border rounded-xl shadow-card-md z-50 max-h-60 overflow-y-auto">
          {loading && suggestions.length === 0 && (
            <div className="p-3 text-xs text-content-muted">Searching vocabulary…</div>
          )}

          {suggestions.map((item, index) => {
            const isSelected = index === selectedIndex
            return (
              <button
                key={item.id ?? item.name}
                type="button"
                onClick={() => handleSelect(item)}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                  isSelected ? 'bg-brand/10 text-brand' : 'hover:bg-surface-section text-content-primary'
                }`}
              >
                <div className="flex items-center gap-2">
                  {item.department && (
                    <DepartmentMark department={item.department} showLabel={false} size="sm" />
                  )}
                  <span className="font-medium text-ink">{item.name}</span>
                  {(item.department || item.state) && (
                    <span className="text-muted text-[11px]">
                      {item.department ?? item.state}
                    </span>
                  )}
                </div>
                <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 px-1.5">
                  Verified
                </span>
              </button>
            )
          })}

          {query.trim() && !isExactVerified && (
            <button
              type="button"
              onClick={handleUseCustom}
              className="w-full text-left px-3 py-2 text-xs flex items-center justify-between border-t border-surface-border bg-amber-50/50 hover:bg-amber-50 text-amber-800 transition-colors"
            >
              <div>
                <span>Use custom: </span>
                <span className="font-semibold">"{query.trim()}"</span>
              </div>
              <span className="badge bg-amber-100 text-amber-800 border-amber-300 text-[10px] py-0 px-1.5">
                Unverified
              </span>
            </button>
          )}

          {!loading && suggestions.length === 0 && !query.trim() && (
            <div className="p-3 text-xs text-content-muted">Type to search vocabulary</div>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
