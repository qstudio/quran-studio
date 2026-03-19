# Quran Studio - Design System

**Status**: Draft
**Aesthetic**: Minimal, editorial, professional. OpenAI meets Final Cut Pro.

---

## 1. Design Philosophy

This is not a "Muslim app with green and gold everywhere." This is a professional creative tool that happens to be built for Quran. The design should feel like it belongs next to Final Cut Pro, Figma, or Notion -- not next to a prayer times widget.

**Principles:**
- **Content is the star.** The mushaf page, the Arabic text, the waveform -- those are the visuals. The UI gets out of the way.
- **Monochrome foundation, color only when it means something.** The interface is grayscale. Color appears only for: the playhead, active selections, highlights, and status indicators.
- **Dense but not cluttered.** Professional tools show a lot of information. The difference between "dense" and "cluttered" is spacing, hierarchy, and consistency. Every pixel of padding is intentional.
- **No decoration.** No gradients on buttons. No drop shadows on cards. No rounded-everything. No emoji. No illustrations. Flat, clean, sharp.
- **Typography does the heavy lifting.** Good type at the right size with the right weight creates hierarchy without needing borders, backgrounds, or visual noise.

---

## 2. Color System

### 2.1 Dark Mode (Default)

The primary mode. Dark mode is not "dark gray with lighter gray." It's true black and white with carefully chosen neutral steps.

```
Background hierarchy:
  --bg-root:        #000000    // app background, canvas area
  --bg-surface:     #0A0A0A    // panels (inspector, project library)
  --bg-elevated:    #141414    // cards, dropdowns, popovers
  --bg-overlay:     #1A1A1A    // modals, dialog backgrounds
  --bg-subtle:      #1F1F1F    // hover states, selected rows

Borders:
  --border-default: #1F1F1F    // subtle dividers between panels
  --border-strong:  #2E2E2E    // explicit borders (input fields, track separators)
  --border-focus:   #FFFFFF    // focus rings

Text:
  --text-primary:   #FAFAFA    // headings, primary content
  --text-secondary: #A0A0A0    // labels, descriptions, metadata
  --text-tertiary:  #5C5C5C    // placeholders, disabled text
  --text-inverse:   #000000    // text on accent-colored backgrounds

Interactive:
  --accent:         #FFFFFF    // primary action buttons, playhead, active tab underlines
  --accent-hover:   #E0E0E0    // hover state for accent elements
  --accent-muted:   #333333    // selected/active backgrounds (sidebar item, selected block)
```

### 2.2 Light Mode

Inverted, not redesigned. Same hierarchy logic, flipped.

```
Background hierarchy:
  --bg-root:        #FFFFFF
  --bg-surface:     #FAFAFA
  --bg-elevated:    #F5F5F5
  --bg-overlay:     #F0F0F0
  --bg-subtle:      #EBEBEB

Borders:
  --border-default: #EBEBEB
  --border-strong:  #D4D4D4
  --border-focus:   #000000

Text:
  --text-primary:   #0A0A0A
  --text-secondary: #6B6B6B
  --text-tertiary:  #A0A0A0
  --text-inverse:   #FFFFFF

Interactive:
  --accent:         #000000
  --accent-hover:   #1A1A1A
  --accent-muted:   #F0F0F0
```

### 2.3 Semantic Colors

Used sparingly. These are functional, not decorative.

```
  --color-success:  #22C55E    // export complete, alignment success
  --color-warning:  #EAB308    // low confidence alignment, export queue full
  --color-error:    #EF4444    // alignment failed, export failed
  --color-info:     #3B82F6    // informational badges, tooltips

  // Timeline-specific
  --color-playhead: #EF4444    // red playhead line (Final Cut Pro convention)
  --color-selection:#3B82F6    // blue selection range on timeline
  --color-ayah-marker: #333333 // ayah boundary markers (dark mode)
```

### 2.4 Quran-Specific Colors

Only used in the preview/export output, never in the app chrome:

```
  // Highlight styles (applied to mushaf/text in preview only)
  --highlight-gold:    #D4A944  // golden glow highlight
  --highlight-blue:    #4A90D9  // blue box highlight
  --highlight-green:   #4A9D6E  // green underline highlight

  // These NEVER appear in the UI itself. They appear on the mushaf page
  // or text overlay in the preview panel and final export only.
```

### 2.5 What's NOT in the palette

- No Islamic green as UI color. This isn't a mosque finder app.
- No gold trim. No ornate borders.
- No gradients anywhere in the UI.
- No brand colors competing with content.

---

## 3. Typography

### 3.1 UI Font

**Inter** -- the same font used by Linear, Vercel, Raycast, and half of modern SaaS. Clean, highly legible at small sizes, excellent for dense UIs.

```
Font stack: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif

Scale:
  --text-xs:   11px / 16px   // metadata, timestamps on timeline ruler
  --text-sm:   13px / 20px   // labels, inspector field names, track headers
  --text-base: 14px / 22px   // body text, inspector values, project names
  --text-lg:   16px / 24px   // panel titles, dialog headings
  --text-xl:   20px / 28px   // project library headings
  --text-2xl:  24px / 32px   // empty state headings, onboarding

Weights:
  --font-regular:  400       // body text, values
  --font-medium:   500       // labels, tab names, button text
  --font-semibold: 600       // panel titles, selected items
```

### 3.2 Arabic Font (Preview/Export Only)

For rendering Quran text in the preview panel and final export:

**Amiri Quran** -- designed specifically for Quranic text, includes all diacritical marks, OpenType features for proper Arabic typesetting.

Fallback: **Scheherazade New** (SIL, open source).

```
Font stack (Arabic content): "Amiri Quran", "Scheherazade New", "Traditional Arabic", serif
```

This font is NOT used in the UI. Only in the preview canvas and exported video.

### 3.3 Monospace Font (Timeline Timestamps)

**JetBrains Mono** or **SF Mono** -- for timestamp displays, frame numbers, technical readouts.

```
Font stack: "JetBrains Mono", "SF Mono", "Cascadia Code", monospace

Used for:
  - Timeline ruler timestamps (00:00, 00:30, 01:00)
  - Playhead position display (01:23.450)
  - Export progress percentage
  - Audio duration
```

---

## 4. Component Library

### 4.1 shadcn/ui as Foundation

Every UI component uses [shadcn/ui](https://ui.shadcn.com/). No custom components unless shadcn doesn't have one. No Material UI. No Ant Design. No Chakra.

shadcn components used:

| Component | Where |
|---|---|
| Button | Export, New Project, all actions |
| Dialog | New project modal, export settings, confirmations |
| DropdownMenu | Reciter picker, surah picker, right-click menus |
| Select | Aspect ratio, resolution, highlight style, translation language |
| Slider | Opacity, padding, zoom, volume |
| Input | Search projects, custom text entry |
| Popover | Color picker wrapper, tooltip-style info |
| Tabs | Inspector panel sections |
| ScrollArea | Project library, reciter list, long inspector panels |
| Separator | Panel dividers |
| Toggle | Track visibility, lock |
| ToggleGroup | Aspect ratio selector (9:16 / 16:9 / 1:1) |
| Tooltip | Toolbar icons, keyboard shortcut hints |
| Sheet | Mobile inspector (bottom sheet) |
| Command | Command palette (Cmd+K) |
| Progress | Export progress, alignment progress |
| Badge | Reciter status (downloaded/available), project mode label |
| Skeleton | Loading states for project thumbnails, reciter list |
| Toast | Export complete, save confirmed, errors |
| ContextMenu | Right-click on timeline blocks |
| AlertDialog | Delete project confirmation |
| Accordion | Inspector sections that collapse |

### 4.2 shadcn/ui Theme Override

Strip shadcn's default styling to match our palette:

```css
/* tailwind.config.ts theme extension */
{
  colors: {
    background: "var(--bg-root)",
    foreground: "var(--text-primary)",
    card: { DEFAULT: "var(--bg-elevated)", foreground: "var(--text-primary)" },
    popover: { DEFAULT: "var(--bg-elevated)", foreground: "var(--text-primary)" },
    primary: { DEFAULT: "var(--accent)", foreground: "var(--text-inverse)" },
    secondary: { DEFAULT: "var(--bg-subtle)", foreground: "var(--text-primary)" },
    muted: { DEFAULT: "var(--bg-subtle)", foreground: "var(--text-secondary)" },
    accent: { DEFAULT: "var(--accent-muted)", foreground: "var(--text-primary)" },
    destructive: { DEFAULT: "var(--color-error)", foreground: "#FFFFFF" },
    border: "var(--border-default)",
    input: "var(--border-strong)",
    ring: "var(--border-focus)",
  },
  borderRadius: {
    lg: "8px",
    md: "6px",
    sm: "4px",
  },
}
```

### 4.3 Button Styles

Three variants. That's it.

```
Primary:    White text on black bg (dark mode) / Black text on white bg (light mode)
            Used for: Export, Create Project -- one per screen max
            
Secondary:  Text-secondary on bg-subtle, border-strong border
            Used for: Cancel, secondary actions
            
Ghost:      Text-secondary, no background, bg-subtle on hover
            Used for: Toolbar icons, inline actions, track controls
```

No outline variant. No gradient variant. No "link" variant. Three.

### 4.4 Icons

**Lucide** (included with shadcn/ui). Consistent stroke width, minimal, monochrome.

```
Timeline:
  Play         -> lucide:play
  Pause        -> lucide:pause
  SkipBack     -> lucide:skip-back
  SkipForward  -> lucide:skip-forward
  ZoomIn       -> lucide:zoom-in
  ZoomOut      -> lucide:zoom-out
  Split        -> lucide:scissors
  Undo         -> lucide:undo-2
  Redo         -> lucide:redo-2

Tracks:
  Visible      -> lucide:eye
  Hidden       -> lucide:eye-off
  Locked       -> lucide:lock
  Unlocked     -> lucide:unlock
  Audio        -> lucide:audio-waveform
  Image        -> lucide:image
  Type         -> lucide:type
  Layers       -> lucide:layers

Project:
  New          -> lucide:plus
  Delete       -> lucide:trash-2
  Duplicate    -> lucide:copy
  Export       -> lucide:download
  Settings     -> lucide:settings
  Search       -> lucide:search

Size: 16px for inline/toolbar, 20px for panel headers, 24px for empty states.
Stroke width: 1.5px (default Lucide).
Color: var(--text-secondary), var(--text-primary) on hover/active.
```

---

## 5. Layout

### 5.1 App Shell

Three-panel layout inspired by Final Cut Pro / DaVinci Resolve:

```
┌─────────────────────────────────────────────────────────────┐
│  ▪ Quran Studio                              [⌘K] [Export] │  <- Title bar (28px)
├────────────┬────────────────────────────────────────────────┤
│            │                                                │
│  Inspector │              Preview Panel                     │  <- Top half
│  (280px)   │         ┌────────────────────┐                 │
│            │         │                    │                 │
│  Context-  │         │  Canvas preview    │                 │
│  sensitive │         │  (aspect ratio     │                 │
│  properties│         │   maintained)      │                 │
│            │         │                    │                 │
│            │         └────────────────────┘                 │
│            │    [◀ ▶ ⏸]  01:23.4 / 04:56.0   [9:16][16:9] │
│            │                                                │
├────────────┴────────────────────────────────────────────────┤
│  00:00      00:15       00:30       00:45       01:00       │  <- Time ruler
│  ─────────────────────────────────────────────────────────  │
│  🔊 Audio   ▃▅▇▆▃▁▃▅▇▅▃▁▃▅▇▆▃▁▃▅▇▅▃▁▃▅▇▆▃▁▃▅▇▅▃▁▃▅▇▆▃ │  <- Tracks
│  📄 Pages   [Page 1          ][Page 2                    ] │
│  ◆ Highlight [·][·][·][·][·][·][·][·][·][·][·][·][·][·][·]│
│  Aa Trans   [In the name of...][All praise is due...     ] │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  [-] Zoom [═══════●═══] [+]                                │  <- Zoom control
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Panel Dimensions

```
Inspector panel:     280px fixed width, collapsible (Cmd+I)
Preview panel:       Fills remaining width, maintains aspect ratio of project
Timeline panel:      Full width, 200px default height, resizable (drag divider)
Title bar:           28px height (native Tauri title bar on Mac)
Time ruler:          24px height
Track lane:          32px height per track
Zoom bar:            28px height
```

### 5.3 Panel Dividers

Thin, 1px, `var(--border-default)`. Draggable to resize. No visible handle -- cursor changes to `col-resize` or `row-resize` on hover.

### 5.4 Project Library (Home Screen)

Grid of project cards. No sidebar. Clean, like Notion's recent pages.

```
┌─────────────────────────────────────────────────────────────┐
│  Quran Studio                          [Search] [+ New]     │
│                                                             │
│  Recent Projects                                            │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ thumbnail │  │ thumbnail │  │ thumbnail │  │ thumbnail │   │
│  │          │  │          │  │          │  │          │   │
│  ├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤   │
│  │Al-Baqarah│  │Al-Mulk   │  │Yasin Reel│  │Al-Fatiha │   │
│  │255-257   │  │Full Surah│  │          │  │Mushaf    │   │
│  │Mushaf    │  │Long-form │  │Reel      │  │          │   │
│  │2 min ago │  │Yesterday │  │3 days ago│  │Last week │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Project cards:
- Thumbnail: first frame of the project preview (mushaf page, text on background, etc.)
- Title: auto-generated from surah name + ayah range
- Mode badge: small text label (Mushaf, Reel, Long-form, Caption)
- Timestamp: relative ("2 min ago", "Yesterday")
- Hover: subtle border highlight
- Right-click: Duplicate, Delete, Rename
- No card shadows. No rounded corners beyond 6px. No color backgrounds.

### 5.5 New Project Flow

Minimal. Three steps, one screen.

```
┌─────────────────────────────────────────┐
│  New Project                        [X] │
│                                         │
│  Mode                                   │
│  ┌────────┐┌────────┐┌────────┐┌──────┐│
│  │ Caption ││  Reel  ││  Long  ││Mushaf││
│  │         ││        ││  form  ││ [●]  ││
│  └────────┘└────────┘└────────┘└──────┘│
│                                         │
│  Audio                                  │
│  (●) Select reciter                     │
│      [Mishary Al-Afasy           ▼]     │
│  ( ) Upload audio file                  │
│  ( ) Record                             │
│                                         │
│  Surah                                  │
│  [Al-Baqarah                     ▼]     │
│  Ayah range: [255] to [257]             │
│                                         │
│                       [Cancel] [Create] │
└─────────────────────────────────────────┘
```

This is a shadcn Dialog. Mode selector is a ToggleGroup. Dropdowns are Select components. Create button is the only Primary button.

---

## 6. Timeline Design Details

### 6.1 Track Styling

```
Track header (left sidebar):
  Background: var(--bg-surface)
  Width: 120px
  Track label: text-sm, font-medium, text-secondary
  Icons: 16px, ghost buttons for lock/visibility
  Active track: text-primary (label brightens)

Track lane:
  Background: var(--bg-root)
  Height: 32px
  Border-bottom: 1px var(--border-default)
  Active/selected track: bg-subtle background
```

### 6.2 Block Styling

Blocks are the rectangles on each track representing content at specific timestamps.

```
Audio block:
  Background: transparent
  Waveform: var(--text-tertiary), peaks rendered as vertical bars
  Waveform active (under playhead): var(--text-secondary)

Mushaf page block:
  Background: var(--bg-elevated)
  Border: 1px var(--border-strong)
  Label: "P.1", "P.2" etc, text-xs, centered
  Selected: border-color var(--accent)
  Corner radius: 4px

Highlight block:
  Background: var(--highlight-gold) at 40% opacity (or current highlight color)
  No border
  Very small (represents a single word, ~10-30px wide at default zoom)
  Selected: white outline

Text block (subtitle/ayah):
  Background: var(--bg-elevated)
  Border: 1px var(--border-default)
  Label: first few words of text, text-xs, truncated
  Selected: border-color var(--accent)
  Corner radius: 4px

Card block (bismillah, surah title):
  Background: var(--bg-elevated) with left-border 2px var(--text-tertiary)
  Label: "Bismillah", "Surah Title", text-xs
```

### 6.3 Playhead

```
Line: 1px var(--color-playhead) (red)
Head: 8px wide triangle at top, same red, sits on the time ruler
Extends full height of timeline
On scrub: slight opacity reduction (0.7) to feel responsive

The playhead is the ONLY red element in the entire UI.
```

### 6.4 Ayah Markers

```
Vertical dashed lines at ayah boundaries
Color: var(--border-default)
Label: ayah number at the top (time ruler area), text-xs, text-tertiary
Only visible when zoomed in enough (otherwise too dense)
```

### 6.5 Selection

```
Range selection on timeline:
  Overlay: var(--color-selection) at 15% opacity
  Border: 1px var(--color-selection)
  
Block selection:
  Border changes to var(--accent)
  Resize handles appear: 4px wide bars on left/right edges
```

### 6.6 Zoom Behavior

```
Min zoom: entire project fits in viewport (surah-level overview)
Max zoom: individual words visible as distinct blocks (~100px per word)
Default zoom: ayah-level (each ayah block is ~80-120px wide)

Zoom control: slider at bottom of timeline
Scroll zoom: Cmd+scroll (Mac), Ctrl+scroll (Windows)
Zoom to fit: double-click zoom slider or Cmd+0
```

---

## 7. Inspector Panel Design

### 7.1 Layout

```
┌──────────────────────┐
│  Inspector     [pin] │  <- Header, 36px
├──────────────────────┤
│                      │
│  Section Title       │  <- text-sm, font-semibold, text-secondary, uppercase tracking-wide
│                      │
│  Label          Value│  <- text-sm, label is text-secondary, value is text-primary
│  Label          Value│
│                      │
│  ────────────────    │  <- Separator
│                      │
│  Section Title       │
│  ...                 │
└──────────────────────┘
```

### 7.2 Field Patterns

```
Dropdown field:     Label on left, shadcn Select on right (140px wide)
Slider field:       Label on left, shadcn Slider on right (140px wide), value display
Color field:        Label on left, color swatch (20x20, rounded-sm) + hex input
Toggle field:       Label on left, shadcn Toggle on right
Number field:       Label on left, shadcn Input (number, 80px wide) with stepper
```

### 7.3 Inspector States

**Nothing selected (project settings):**
```
PROJECT
Reciter         [Mishary Al-Afasy  ▼]
Surah           [Al-Baqarah        ▼]
Ayah Range      [255] to [257]
─────────────────────
EXPORT
Format          [MP4               ▼]
Resolution      [1080p             ▼]
Aspect Ratio    [9:16] [16:9] [1:1]
```

**Highlight block selected:**
```
HIGHLIGHT
Style           [Golden Glow       ▼]
Color           [■ #D4A944        ]
Opacity         ═══════●═══  0.60
Padding         ═══●═══════  4px
─────────────────────
POSITION
Word            بِسْمِ
Ayah            1:1, word 1
Start           00:00.000
End             00:00.450
```

**Mushaf page block selected:**
```
PAGE
Page Number     1
Transition      [Crossfade         ▼]
Duration        ═══●═══════  500ms
─────────────────────
TIMING
Start           00:00.000
End             00:45.200
```

---

## 8. Preview Panel Design

### 8.1 Layout

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              ┌───────────────────┐              │
│              │                   │              │ <- Canvas maintains
│              │   Preview canvas  │              │    aspect ratio,
│              │   (letterboxed)   │              │    letterboxed in
│              │                   │              │    available space
│              └───────────────────┘              │
│                                                 │
│  [◀] [▶ Play] [◀◀]    01:23.4 / 04:56.0       │ <- Transport controls
│                                                 │
│  [9:16] [16:9] [1:1]                           │ <- Aspect ratio toggle
└─────────────────────────────────────────────────┘
```

### 8.2 Styling

```
Preview area background: #000000 (always, both modes -- content is the focus)
Canvas border: none (content goes edge to edge within its aspect ratio)
Letterbox bars: #000000 (blend with background)

Transport controls:
  Background: var(--bg-surface)
  Height: 40px
  Buttons: ghost variant, 20px icons
  Timestamp: monospace font, text-sm, text-secondary
  Playing timestamp: text-primary

Aspect ratio toggle:
  shadcn ToggleGroup, text-xs
  Active: accent-muted background
```

### 8.3 Preview Quality

During scrubbing: render at 50% resolution for speed, upscale with CSS.
During playback: render at full resolution, target 30fps.
Paused: always full resolution.

---

## 9. Motion and Animation

### 9.1 Principles

- **Functional, not decorative.** Animation communicates state change, not personality.
- **Fast.** 150ms for most transitions. 200ms maximum. Nothing ever takes 300ms+.
- **Ease-out only.** `cubic-bezier(0.16, 1, 0.3, 1)` for enters. No bouncing. No spring physics. No elastic.

### 9.2 Specific Animations

```
Panel collapse/expand:    150ms, width/height transition
Dialog open:              150ms, opacity 0->1 + scale 0.98->1
Dialog close:             100ms, opacity 1->0
Dropdown open:            100ms, opacity + translateY(-4px -> 0)
Toast appear:             150ms, slide in from bottom-right
Toast dismiss:            100ms, opacity out
Block hover:              instant border color change (no transition)
Block select:             instant (no transition -- snappy)
Playhead move:            no animation (follows cursor exactly)
Timeline zoom:            100ms, smooth interpolation
Track expand/collapse:    150ms, height transition
Inspector panel switch:   0ms (instant content swap, no crossfade)
```

### 9.3 What Does NOT Animate

- Inspector content changes (instant swap)
- Track reordering (instant, no drag animation yet -- add later if needed)
- Block timing adjustments (instant visual update)
- Color changes in color picker (instant)

---

## 10. Responsive Breakpoints

```
Desktop (default):    >= 1024px    Full three-panel layout
Tablet:               768-1023px   Inspector collapses to icon bar, click to expand as overlay
Phone:                < 768px      Stack layout: preview on top, timeline below, inspector as bottom sheet

Mobile-specific:
  - Inspector becomes shadcn Sheet (bottom drawer)
  - Timeline is full-width
  - Preview is compact (40% of screen height)
  - Track headers collapse to icons only
  - Zoom defaults to ayah-level
  - Touch targets: minimum 44px
```

---

## 11. Empty States

No illustrations. No cute drawings. Just clear text.

```
No projects yet:
  ┌─────────────────────────┐
  │                         │
  │    No projects          │  <- text-xl, text-primary
  │    Create your first    │  <- text-base, text-secondary
  │    Quran video.         │
  │                         │
  │    [+ New Project]      │  <- Primary button
  │                         │
  └─────────────────────────┘

No reciter downloaded:
  "Select a reciter to download their audio library."
  [Browse Reciters]

Export complete:
  Toast: "Export complete. Video saved to ~/Downloads/Al-Baqarah_255-257.mp4"
  [Open File] [Open Folder]
```

---

## 12. Keyboard-First

This is a professional tool. Power users live on the keyboard.

### 12.1 Command Palette (Cmd+K)

shadcn Command component. Searches: projects, surahs, reciters, actions.

```
┌─────────────────────────────────────┐
│  > search...                        │
├─────────────────────────────────────┤
│  Projects                           │
│    Al-Baqarah 255-257 (Mushaf)     │
│    Al-Mulk Full Surah (Long-form)  │
│  Actions                            │
│    New Project            Cmd+N     │
│    Export                 Cmd+E     │
│    Toggle Inspector       Cmd+I     │
│    Zoom to Fit            Cmd+0     │
│  Surahs                             │
│    Al-Fatiha                        │
│    Al-Baqarah                       │
└─────────────────────────────────────┘
```

### 12.2 Shortcut Display

Every action in menus and tooltips shows its keyboard shortcut. Right-aligned, `text-tertiary`, monospace.

---

## 13. Loading States

shadcn Skeleton for all async content:

```
Project thumbnails:    Skeleton rectangle (aspect ratio of card)
Reciter list:          Skeleton lines (4 rows)
Alignment processing:  Progress bar with percentage + "Aligning audio..." label
Export:                Progress bar with percentage + time estimate
Audio waveform:        Skeleton gradient pulse in track lane
```

No spinners. Skeleton shimmer is the only loading indicator. Gray pulse on `var(--bg-elevated)`.

---

## 14. What This Is NOT

- Not green and gold Islamic aesthetic
- Not Bootstrap, Material UI, Ant Design, or Chakra
- Not rounded-xl everything
- Not shadow-lg on every card
- Not colorful tags and badges everywhere
- Not an app that looks like a Notion template
- Not "Figma redesign concept" that's impractical to build
- Not a landing page. This is a tool. Dense, functional, fast.

The reference points are: **Final Cut Pro** (timeline), **Linear** (polish), **Notion** (simplicity), **OpenAI Playground** (monochrome professionalism), **Figma** (panel layout), **Adobe Premiere** (professional density).
