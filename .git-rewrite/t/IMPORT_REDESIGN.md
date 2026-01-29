# SoulPrint Import Page Redesign Brief

## Design Goals
1. **SINGLE VIEWPORT** — Everything fits on one screen, no scrolling
2. **Hover interactions** — Tooltips/popovers showing contextual info
3. **Clean, minimal design** — Focused, distraction-free UI
4. **File drag-and-drop zone** — Primary interaction pattern

---

## Reference Designs & Components

### 1. sadmann7/file-uploader ⭐ (1.4k stars)
**Live Demo:** https://uploader.sadmn.com  
**GitHub:** https://github.com/sadmann7/file-uploader

**Why it's great:**
- Clean, centered dropzone with subtle dashed border
- "Drag & drop files here" with "Or click to browse" secondary text
- Shows file constraints clearly (max 2 files, up to 5MB each)
- Progress bar integration
- React Hook Form integration example
- Built with shadcn/ui + react-dropzone + uploadthing

**Borrow:** The constraint messaging pattern, centered layout

---

### 2. shadcn-dropzone (NPM Package)
**Demo:** https://diragb.github.io/shadcn-dropzone/  
**GitHub:** https://github.com/diragb/shadcn-dropzone  
**NPM:** `npm install shadcn-dropzone`

**Why it's great:**
- Minimal API, ready to use out of the box
- State-aware UI (`isDragAccept` state for visual feedback)
- Customizable child render function for full control
- Lightweight, no external UI dependencies beyond shadcn

**Borrow:** The state-based visual feedback pattern

---

### 3. janglad/shadcn-dropzone
**Docs:** https://shadcn-dropzone.vercel.app/  
**GitHub:** https://github.com/janglad/shadcn-dropzone

**Why it's great:**
- Official shadcn CLI installation: `pnpx shadcn@latest add 'https://shadcn-dropzone.vercel.app/dropzone.json'`
- Fully accessible (ARIA labels, keyboard navigation)
- Built on shadcn primitives, consistent styling
- Clean component architecture

**Borrow:** Accessibility patterns, shadcn-native approach

---

### 4. Uploadcare File Uploader UX Patterns
**Article:** https://uploadcare.com/blog/file-uploader-ux-best-practices/

**Key UX Principles:**
- Drag-and-drop as primary action
- Real-time file validation (type + size) with immediate feedback
- Progress indicators for upload status
- File preview thumbnails before upload
- Clear, friendly error messages ("File is too big. Max file size is 2MB.")
- Easy file removal/replacement
- Responsive design (desktop & mobile)

---

### 5. 21st.dev File Upload Components
**Category:** https://21st.dev/s/upload-download  
**Tooltips:** https://21st.dev/s/tooltip (28 components)  
**Popovers:** https://21st.dev/s/popover (23 components)

**Notable components to explore:**
- `ephraimduncan/file-upload` — Community favorite
- Various tooltip implementations for hover interactions

---

## Layout Recommendation

### Single Viewport Structure
```
┌─────────────────────────────────────────────────────┐
│                    HEADER (minimal)                 │
│               Logo + "Import SoulPrint"             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │                                               │  │
│  │           ┌─────────────────────┐             │  │
│  │           │                     │             │  │
│  │           │    📁 DROPZONE      │             │  │
│  │           │                     │             │  │
│  │           │  Drag & drop here   │             │  │
│  │           │  or click to browse │             │  │
│  │           │                     │             │  │
│  │           └─────────────────────┘             │  │
│  │                                               │  │
│  │   [?] Supported formats (hover for details)   │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│              [ Import ] button (disabled until file)│
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Key Layout Principles
- **Centered dropzone** — Single focal point, no visual competition
- **Vertical centering** — Use flexbox `items-center justify-center min-h-screen`
- **Max-width constraint** — `max-w-xl` or `max-w-2xl` for the card
- **Generous whitespace** — Let the dropzone breathe
- **No sidebar** — Everything in one flow

---

## Component Suggestions

### Core shadcn Components
```bash
pnpm dlx shadcn@latest add card button tooltip hover-card popover
```

| Component | Use Case |
|-----------|----------|
| `Card` | Container for the import area |
| `Button` | Import action, browse files |
| `Tooltip` | Quick hints on hover (file formats, size limits) |
| `HoverCard` | Rich previews (show example import format) |
| `Popover` | Interactive help content |

### Dropzone Options
**Option A: shadcn-dropzone (recommended)**
```bash
pnpx shadcn@latest add 'https://shadcn-dropzone.vercel.app/dropzone.json'
```

**Option B: shadcn-dropzone NPM**
```bash
npm install shadcn-dropzone
```

**Option C: Build custom with react-dropzone**
```bash
npm install react-dropzone
```

---

## Hover Tooltip Implementation

### Pattern 1: Simple Tooltips (for hints)
```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { HelpCircle } from "lucide-react"

<Tooltip>
  <TooltipTrigger asChild>
    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
  </TooltipTrigger>
  <TooltipContent>
    <p>Supported: .json, .txt, .md (max 5MB)</p>
  </TooltipContent>
</Tooltip>
```

### Pattern 2: HoverCard (for rich previews)
```tsx
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"

<HoverCard openDelay={200}>
  <HoverCardTrigger asChild>
    <Button variant="link">What's a SoulPrint file?</Button>
  </HoverCardTrigger>
  <HoverCardContent className="w-80">
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">SoulPrint Export Format</h4>
      <p className="text-sm text-muted-foreground">
        A JSON file containing your personality data, preferences, and memory artifacts.
      </p>
      <pre className="text-xs bg-muted p-2 rounded">
        {"{ \"version\": 2, \"traits\": [...] }"}
      </pre>
    </div>
  </HoverCardContent>
</HoverCard>
```

### Pattern 3: Interactive Info Icons
Place small `(?)` or `ℹ️` icons next to key elements:
- File format requirements
- Size limits
- What happens after import

---

## Visual Design Notes

### Dropzone States
| State | Visual |
|-------|--------|
| Default | Dashed border, muted background |
| Drag hover | Solid border, accent color, subtle scale up |
| File selected | Solid border, file preview/name shown |
| Error | Red border, error message |
| Uploading | Progress bar, disable interactions |

### Color Palette (stick to shadcn defaults)
- `bg-background` — main background
- `bg-muted` — dropzone background
- `border-dashed border-muted-foreground/25` — default border
- `border-primary` — active/hover state
- `text-muted-foreground` — secondary text

### Typography
- Heading: `text-2xl font-semibold tracking-tight`
- Subtext: `text-sm text-muted-foreground`
- Dropzone main: `text-lg font-medium`
- Dropzone hint: `text-sm text-muted-foreground`

---

## Implementation Checklist

- [ ] Set up page with `min-h-screen flex items-center justify-center`
- [ ] Add shadcn Card component as container
- [ ] Integrate dropzone component (recommend janglad's)
- [ ] Add Tooltip for file format info
- [ ] Add HoverCard for "learn more" interactions
- [ ] Implement drag states (visual feedback)
- [ ] Add file preview after selection
- [ ] Wire up import button
- [ ] Test keyboard accessibility
- [ ] Test on mobile (responsive)

---

## Resources

- **shadcn/ui Tooltip docs:** https://ui.shadcn.com/docs/components/radix/tooltip
- **shadcn/ui HoverCard docs:** https://ui.shadcn.com/docs/components/radix/hover-card
- **shadcn/ui Popover docs:** https://ui.shadcn.com/docs/components/popover
- **react-dropzone:** https://react-dropzone.js.org/
- **21st.dev components:** https://21st.dev/s/upload-download
- **Dribbble file upload inspiration:** https://dribbble.com/tags/file_upload
