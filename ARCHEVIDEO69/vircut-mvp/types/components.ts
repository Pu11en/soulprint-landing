import React from 'react'

// Base component props
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
  id?: string
  'data-testid'?: string
}

// Size variants
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type ButtonSize = 'sm' | 'md' | 'lg'
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

// Color variants
export type ColorVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'

// Button variants
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'

// Input types
export type InputType = 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url'

// Validation states
export type ValidationState = 'valid' | 'invalid' | 'warning'

// Position types
export type Position = 'top' | 'right' | 'bottom' | 'left'

// Alignment types
export type Alignment = 'start' | 'center' | 'end' | 'justify'

// Direction types
export type Direction = 'horizontal' | 'vertical'

// Loading states
export interface LoadingState {
  isLoading: boolean
  loadingText?: string
}

// Option types for selects, dropdowns, etc.
export interface Option {
  value: string | number
  label: string
  disabled?: boolean
  icon?: React.ReactNode
  description?: string
}

// Dropdown item types
export interface DropdownItem {
  id: string
  label: string
  icon?: React.ReactNode
  disabled?: boolean
  danger?: boolean
  onClick?: () => void
  href?: string
  target?: string
}

// Pagination types
export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  showFirstLast?: boolean
  showPrevNext?: boolean
  maxVisiblePages?: number
}

// Tab types
export interface Tab {
  id: string
  label: string
  content: React.ReactNode
  disabled?: boolean
  icon?: React.ReactNode
  badge?: string | number
}

// Accordion item types
export interface AccordionItem {
  id: string
  title: string
  content: React.ReactNode
  disabled?: boolean
  icon?: React.ReactNode
  defaultOpen?: boolean
}

// Modal types
export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  size?: Size
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  preventClose?: boolean
}

// Card types
export interface CardProps extends BaseComponentProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  footer?: React.ReactNode
  image?: string
  variant?: 'default' | 'outlined' | 'elevated'
  padding?: Size
}

// List item types
export interface ListItemProps extends BaseComponentProps {
  title: string
  subtitle?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  actions?: React.ReactNode
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
}

// Form field types
export interface FormFieldProps extends BaseComponentProps {
  label: string
  error?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
  validationState?: ValidationState
}

// Search box types
export interface SearchBoxProps extends BaseComponentProps {
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onSearch?: (value: string) => void
  onClear?: () => void
  loading?: boolean
  suggestions?: Option[]
  showSuggestions?: boolean
  onSuggestionSelect?: (option: Option) => void
}

// Tooltip types
export interface TooltipProps extends BaseComponentProps {
  content: React.ReactNode
  position?: Position
  delay?: number
  disabled?: boolean
  arrow?: boolean
  maxWidth?: number
}

// Progress types
export interface ProgressProps extends BaseComponentProps {
  value: number
  max?: number
  size?: Size
  color?: ColorVariant
  showLabel?: boolean
  labelFormat?: (value: number, max: number) => string
  animated?: boolean
  striped?: boolean
}

// Slider types
export interface SliderProps extends BaseComponentProps {
  value: number | number[]
  onChange: (value: number | number[]) => void
  min?: number
  max?: number
  step?: number
  marks?: { value: number; label: string }[]
  disabled?: boolean
  showTooltip?: boolean
  tooltipFormat?: (value: number) => string
  range?: boolean
}

// Avatar types
export interface AvatarProps extends BaseComponentProps {
  src?: string
  alt?: string
  size?: Size
  fallback?: string
  status?: 'online' | 'offline' | 'away' | 'busy'
  showStatus?: boolean
}

// Badge types
export interface BadgeProps extends BaseComponentProps {
  variant?: ColorVariant
  size?: Size
  outlined?: boolean
  removable?: boolean
  onRemove?: () => void
}

// Icon types
export interface IconProps extends BaseComponentProps {
  name: string
  size?: Size | number
  color?: string
  rotate?: number
  spin?: boolean
}

// Spinner types
export interface SpinnerProps extends BaseComponentProps {
  size?: Size
  color?: ColorVariant | string
  label?: string
}

// Toggle types
export interface ToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string
  description?: string
  size?: ComponentSize
  disabled?: boolean
  loading?: boolean
}

// Checkbox types
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string
  description?: string
  indeterminate?: boolean
  size?: ComponentSize
  disabled?: boolean
  error?: string
}

// Radio types
export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string
  description?: string
  size?: ComponentSize
  disabled?: boolean
  error?: string
}

// Radio group types
export interface RadioGroupProps extends BaseComponentProps {
  name: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  direction?: Direction
  disabled?: boolean
  error?: string
  required?: boolean
}

// Select types
export interface SelectProps extends Omit<React.InputHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: Option[]
  value?: string | number
  onChange: (value: string | number) => void
  placeholder?: string
  searchable?: boolean
  clearable?: boolean
  loading?: boolean
  error?: string
  helperText?: string
  label?: string
  required?: boolean
  disabled?: boolean
  multi?: boolean
  maxVisibleValues?: number
}

// Dropdown types
export interface DropdownProps extends BaseComponentProps {
  trigger: React.ReactNode
  items: DropdownItem[]
  position?: Position
  align?: Alignment
  closeOnSelect?: boolean
  disabled?: boolean
}

// Breadcrumb types
export interface BreadcrumbProps extends BaseComponentProps {
  items: BreadcrumbItem[]
  separator?: React.ReactNode
  maxItems?: number
  showHome?: boolean
}

export interface BreadcrumbItem {
  label: string
  href?: string
  active?: boolean
  icon?: React.ReactNode
}

// Responsive breakpoint types
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

// Theme context types
export interface ThemeContextType {
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  resolvedTheme: 'light' | 'dark'
  toggleTheme: () => void
}

// Animation types
export interface AnimationProps {
  duration?: number
  delay?: number
  easing?: string
  enter?: string
  exit?: string
}

// Gesture types for touch interactions
export interface GestureHandlers {
  onTap?: (event: React.TouchEvent) => void
  onDoubleTap?: (event: React.TouchEvent) => void
  onLongPress?: (event: React.TouchEvent) => void
  onSwipeLeft?: (event: React.TouchEvent) => void
  onSwipeRight?: (event: React.TouchEvent) => void
  onSwipeUp?: (event: React.TouchEvent) => void
  onSwipeDown?: (event: React.TouchEvent) => void
  onPinch?: (event: React.TouchEvent, scale: number) => void
  onRotate?: (event: React.TouchEvent, rotation: number) => void
}

// Performance monitoring types
export interface PerformanceMetrics {
  renderTime: number
  interactionTime: number
  memoryUsage: number
  fps: number
}

// Accessibility types
export interface AccessibilityProps {
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-expanded'?: boolean
  'aria-selected'?: boolean
  'aria-disabled'?: boolean
  'aria-required'?: boolean
  'aria-invalid'?: boolean
  'aria-live'?: 'polite' | 'assertive' | 'off'
  role?: string
  tabIndex?: number
}