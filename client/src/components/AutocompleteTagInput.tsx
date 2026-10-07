import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { Check, X, AlertCircle } from 'lucide-react'
import { vocabApi, VocabItem } from '../lib/api'
import { DepartmentMark } from './ui/DepartmentMark'

const COMMON_LANGUAGES: VocabItem[] = [
  { name: 'Hindi' },
  { name: 'English' },
  { name: 'Tamil' },
  { name: 'Telugu' },
  { name: 'Malayalam' },
  { name: 'Kannada' },
  { name: 'Bengali' },
  { name: 'Marathi' },
  { name: 'Punjabi' },
  { name: 'Gujarati' },
  { name: 'Odia' },
  { name: 'Assamese' },
  { name: 'Urdu' },
  { name: 'Bhojpuri' },
  { name: 'Konkani' },
  { name: 'Spanish' },
  { name: 'French' },
  { name: 'German' },
  { name: 'Japanese' },
  { name: 'Korean' },
]

interface AutocompleteTagInputProps {
  label: string
  placeholder: string
  tags: string[]
  onChange: (tags: string[]) => void
  type: 'skills' | 'roles' | 'languages'
  error?: string
  maxTags?: number
  helpText?: string
}

export function AutocompleteTagInput({
  label,
  placeholder,
  tags,
  onChange,
  type,
  error,
  maxTags = 20,
  helpText,
}: AutocompleteTagInputProps) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<VocabItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch suggestions
  useEffect(() => {
    if (!isOpen || !input.trim()) {
      setSuggestions([])
      return
    }

    let active = true
    setLoading(true)

    if (type === 'languages') {
      const q = input.trim().toLowerCase()
      const existingLower = new Set(tags.map((t) => t.toLowerCase()))
      const matched = COMMON_LANGUAGES.filter(
        (item) => item.name.toLowerCase().includes(q) && !existingLower.has(item.name.toLowerCase())
      )
      setSuggestions(matched)
      setSelectedIndex(-1)
      setLoading(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const fetcher = type === 'skills' ? vocabApi.skills : vocabApi.roles
        const res = await fetcher(input)
        if (active) {
          const list =
            (type === 'skills'
              ? (res as { skills: VocabItem[] }).skills
              : (res as { roles: VocabItem[] }).roles) || []
          // Filter out already selected tags
          const existingLower = new Set(tags.map((t) => t.toLowerCase()))
          setSuggestions(list.filter((item) => !existingLower.has(item.name.toLowerCase())))
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
  }, [input, type, isOpen, tags])

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

  const addTag = (tagName: string) => {
    const trimmed = tagName.trim()
    if (!trimmed) return
    if (tags.length >= maxTags) return

    const lower = trimmed.toLowerCase()
    if (!tags.some((t) => t.toLowerCase() === lower)) {
      onChange([...tags, trimmed])
    }
    setInput('')
    setIsOpen(false)
  }

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && isOpen && suggestions.length > 0) {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
      return
    }
    if (e.key === 'ArrowUp' && isOpen && suggestions.length > 0) {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
      return
    }

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (isOpen && selectedIndex >= 0 && selectedIndex < suggestions.length) {
        addTag(suggestions[selectedIndex].name)
      } else {
        addTag(input)
      }
      return
    }

    if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center justify-between mb-1">
        <label className="text-12 font-semibold text-muted block">{label}</label>
        <span className="text-11 text-muted">
          {tags.length}/{maxTags} selected
        </span>
      </div>

      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-[3px] bg-surface border px-2.5 py-1 min-h-[38px]
        focus-within:border-ink transition-colors
        ${error ? 'border-status-error' : 'border-line'}`}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-paper text-ink border border-line text-11 px-2 py-0.5 rounded-sm font-medium"
          >
            <span>{tag}</span>
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-muted hover:text-ink transition-colors p-0.5"
              aria-label={`Remove ${tag}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}

        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => {
            if (input.trim()) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : 'Add more…'}
          className="flex-1 min-w-[120px] bg-transparent text-13 text-ink placeholder:text-muted outline-none py-0.5"
        />
      </div>

      {isOpen && input.trim() && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-line rounded-sm shadow-card-md z-50 max-h-60 overflow-y-auto">
          {loading && suggestions.length === 0 && (
            <div className="p-3 text-12 text-muted">Searching…</div>
          )}

          {suggestions.map((item, index) => {
            const isSelected = index === selectedIndex
            return (
              <button
                key={item.id ?? item.name}
                type="button"
                onClick={() => addTag(item.name)}
                className={`w-full text-left px-3 py-2 text-12 flex items-center justify-between transition-colors ${
                  isSelected ? 'bg-paper text-ink font-semibold' : 'hover:bg-paper text-ink'
                }`}
              >
                <div className="flex items-center gap-2">
                  {(item.department || item.category) && (
                    <DepartmentMark
                      department={item.department || item.category || 'production'}
                      showLabel={false}
                      size="sm"
                    />
                  )}
                  <span className="font-medium text-ink">{item.name}</span>
                  {(item.category || item.department) && (
                    <span className="text-muted text-11">
                      {item.category ?? item.department}
                    </span>
                  )}
                </div>
                <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 px-1.5">
                  <Check size={10} className="mr-0.5 inline" /> Verified
                </span>
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => addTag(input)}
            className="w-full text-left px-3 py-2 text-12 flex items-center justify-between border-t border-line bg-amber-50/50 hover:bg-amber-50 text-amber-800 transition-colors"
          >
            <div>
              <span>Add custom: </span>
              <span className="font-semibold">&ldquo;{input.trim()}&rdquo;</span>
            </div>
            <span className="badge bg-amber-100 text-amber-800 border-amber-300 text-[10px] py-0 px-1.5">
              <AlertCircle size={10} className="mr-0.5 inline" /> Custom
            </span>
          </button>
        </div>
      )}

      {helpText !== '' && (
        <p className="mt-1 text-11 text-muted">
          {helpText || 'Select from dropdown or press Enter to add'}
        </p>
      )}
      {error && <p className="mt-1 text-11 text-status-error">{error}</p>}
    </div>
  )
}
