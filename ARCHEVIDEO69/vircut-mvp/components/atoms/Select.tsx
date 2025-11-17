import React, { useState, useRef, useEffect, useCallback } from 'react'
import { cn, generateId, debounce } from '@/utils'
import { ChevronDown, X, Check } from 'lucide-react'
import { SelectProps, Option } from '@/types/components'

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      options,
      value,
      onChange,
      placeholder = 'Select an option',
      searchable = false,
      clearable = false,
      loading = false,
      error,
      helperText,
      label,
      required = false,
      disabled = false,
      multi = false,
      maxVisibleValues = 3,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const [selectedValues, setSelectedValues] = useState<string[]>(
      multi && value ? (Array.isArray(value) ? value.map(String) : [String(value)]) : value ? [String(value)] : []
    )
    
    const selectRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLUListElement>(null)
    const selectId = generateId('select')
    
    // Filter options based on search term
    const filteredOptions = options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !option.disabled
    )
    
    // Get selected option(s)
    const getSelectedOptions = useCallback(() => {
      if (multi) {
        return options.filter(option => selectedValues.includes(String(option.value)))
      }
      return options.find(option => String(option.value) === selectedValues[0])
    }, [options, selectedValues, multi])
    
    // Handle option selection
    const handleOptionSelect = useCallback((option: Option) => {
      if (multi) {
        const newValues = selectedValues.includes(String(option.value))
          ? selectedValues.filter(v => v !== String(option.value))
          : [...selectedValues, String(option.value)]
        
        setSelectedValues(newValues)
        onChange?.(newValues)
      } else {
        setSelectedValues([String(option.value)])
        onChange?.(option.value)
        setIsOpen(false)
        setSearchTerm('')
      }
    }, [selectedValues, onChange, multi])
    
    // Handle clear selection
    const handleClear = useCallback(() => {
      setSelectedValues([])
      onChange?.(multi ? [] : '')
      setSearchTerm('')
    }, [onChange, multi])
    
    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setIsOpen(true)
          inputRef.current?.focus()
        }
        return
      }
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex(prev => 
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            handleOptionSelect(filteredOptions[highlightedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          setIsOpen(false)
          break
      }
    }, [isOpen, highlightedIndex, filteredOptions, handleOptionSelect])
    
    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }
      
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])
    
    // Scroll highlighted option into view
    useEffect(() => {
      if (highlightedIndex >= 0 && listRef.current) {
        const highlightedItem = listRef.current.children[highlightedIndex] as HTMLElement
        if (highlightedItem) {
          highlightedItem.scrollIntoView({ block: 'nearest' })
        }
      }
    }, [highlightedIndex])
    
    const selectedOptions = getSelectedOptions()
    const displayValue = multi
      ? selectedOptions.slice(0, maxVisibleValues)
      : selectedOptions?.label || placeholder
    
    const baseClasses = 'relative w-full'
    const triggerClasses = cn(
      'flex items-center justify-between w-full h-10 px-3 py-2 text-sm bg-background border border-input rounded-md',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'transition-colors touch-button',
      error && 'border-error',
      disabled && 'cursor-not-allowed opacity-50',
      className
    )
    
    const dropdownClasses = cn(
      'absolute z-50 w-full mt-1 bg-background border border-input rounded-md shadow-lg',
      'max-h-60 overflow-auto',
      'focus:outline-none',
      'animate-in fade-in-0 zoom-in-95'
    )
    
    return (
      <div className={cn('space-y-2', className)}>
        {label && (
          <label
            htmlFor={selectId}
            className={cn(
              'text-sm font-medium leading-none',
              required && "after:content-['*'] after:ml-1 after:text-error"
            )}
          >
            {label}
          </label>
        )}
        
        <div className={baseClasses} ref={selectRef}>
          <div
            className={triggerClasses}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            onKeyDown={handleKeyDown}
            tabIndex={disabled ? -1 : 0}
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-disabled={disabled}
          >
            <div className="flex items-center flex-1 min-w-0">
              {multi && selectedOptions.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedOptions.slice(0, maxVisibleValues).map((option, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 text-xs bg-primary/10 text-primary rounded"
                    >
                      {option.label}
                    </span>
                  ))}
                  {selectedOptions.length > maxVisibleValues && (
                    <span className="text-xs text-muted-foreground">
                      +{selectedOptions.length - maxVisibleValues} more
                    </span>
                  )}
                </div>
              ) : (
                <span className={cn(!selectedOptions && 'text-muted-foreground')}>
                  {displayValue}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              {loading && (
                <div className="animate-spin h-4 w-4">
                  <svg viewBox="0 0 24 24" className="h-4 w-4">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              )}
              
              {clearable && selectedValues.length > 0 && !loading && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClear()
                  }}
                  className="p-1 rounded-sm hover:bg-accent"
                  aria-label="Clear selection"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </div>
          </div>
          
          {isOpen && (
            <div className={dropdownClasses}>
              {searchable && (
                <div className="p-2 border-b border-input">
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="w-full h-8 px-2 text-sm bg-background border border-input rounded"
                    autoFocus
                  />
                </div>
              )}
              
              <ul
                ref={listRef}
                className="py-1"
                role="listbox"
                aria-multiselectable={multi}
              >
                {filteredOptions.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">
                    No options found
                  </li>
                ) : (
                  filteredOptions.map((option, index) => {
                    const isSelected = selectedValues.includes(String(option.value))
                    const isHighlighted = index === highlightedIndex
                    
                    return (
                      <li
                        key={option.value}
                        className={cn(
                          'flex items-center px-3 py-2 text-sm cursor-pointer',
                          'hover:bg-accent hover:text-accent-foreground',
                          'focus:bg-accent focus:text-accent-foreground',
                          isSelected && 'bg-primary/10 text-primary',
                          isHighlighted && 'bg-accent',
                          option.disabled && 'opacity-50 cursor-not-allowed'
                        )}
                        onClick={() => !option.disabled && handleOptionSelect(option)}
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={option.disabled}
                      >
                        {option.icon && (
                          <span className="mr-2 flex-shrink-0">
                            {option.icon}
                          </span>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{option.label}</div>
                          {option.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {option.description}
                            </div>
                          )}
                        </div>
                        
                        {isSelected && (
                          <Check className="h-4 w-4 ml-2 flex-shrink-0" />
                        )}
                      </li>
                    )
                  })
                )}
              </ul>
            </div>
          )}
        </div>
        
        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}
        
        {helperText && !error && (
          <p className="text-sm text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select