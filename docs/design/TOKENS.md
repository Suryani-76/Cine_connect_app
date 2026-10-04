# CineConnect — Design Tokens & UI System Reference

**Source of Truth:** [docs/design/BRIEF.md](file:///Users/bhargav/Cine_Connect/docs/design/BRIEF.md)  
**Implementation:** `client/src/index.css`, `client/tailwind.config.js`, `client/src/components/ui/`  
**Review Route:** `/design` (DEV only)

---

## 1. Aesthetic Foundations

CineConnect operates in the world of the **film set**. The interface reflects a well-run production office: dense where people work, quiet everywhere else, and instantly legible. Work is framed by call sheets, shot lists, lighting gels, and light meters.

Two ideas carry the system:
1. **The Light Meter:** The 0–100 match score is CineConnect's core differentiator. It uses a horizontal exposure scale with tick marks and a needle, not a generic circular percentage ring.
2. **Gel Colour-Coding by Department:** Camera, sound, editing, art & costume, cast, and production each possess one fixed lighting-gel colour used exclusively for scannable department identification.

---

## 2. Token Palette & CSS Variables

Tokens are implemented as CSS custom properties in `client/src/index.css` and mapped directly into `client/tailwind.config.js`.

### 2.1 Core Tokens
| Token | Light Value | Dark Value | TailWind Class | Usage |
|---|---|---|---|---|
| **Ink** | `#0E1B2E` | `#EEF1F4` | `text-ink`, `bg-ink`, `border-ink` | Text, nav rail, dark mode background |
| **Paper** | `#EEF1F4` | `#0A1424` | `bg-paper` | App background (cool grey-white, deliberately not cream) |
| **Surface** | `#FFFFFF` | `#16263D` | `bg-surface` | Panels, data rows, form elements |
| **Tungsten** | `#F2A33A` | `#F2A33A` | `bg-tungsten` | Primary action fill, meter needle, one highlight per screen. **Fill only; never text on white** |
| **Line** | `#D5DBE3` | `#22354E` | `border-line`, `divide-line` | Dividers, structural table borders, input borders |
| **Muted** | `#5A6A7E` | `#8B9BB0` | `text-muted` | Secondary text (AA contrast checked on Paper) |

### 2.2 Department Lighting Gels
Used strictly as information markers (dots / small squares) beside roles and skills so lists can be scanned by department. Never used as general decorative accents.

| Department | Light Hex | Dark Hex | Class | Dot Color Var |
|---|---|---|---|---|
| **Camera** | `#2F6FDE` | `#3B82F6` | `bg-gel-camera` | `--color-gel-camera` |
| **Sound** | `#7A4FD1` | `#8B5CF6` | `bg-gel-sound` | `--color-gel-sound` |
| **Editing** | `#12968A` | `#14B8A6` | `bg-gel-editing` | `--color-gel-editing` |
| **Art & Costume** | `#D14B6F` | `#F43F5E` | `bg-gel-art` | `--color-gel-art` |
| **Cast** | `#D98A1F` | `#F59E0B` | `bg-gel-cast` | `--color-gel-cast` |
| **Production** | `#5B6B7F` | `#94A3B8` | `bg-gel-production` | `--color-gel-production` |

### 2.3 Status Colours
Separate from department gels. Used strictly for statuses (errors, successes, warnings).
- **Success:** `#0E8A5E` (dark: `#10B981`) -> `text-status-success`, `bg-status-success`
- **Warning:** `#D97706` (dark: `#F59E0B`) -> `text-status-warning`, `bg-status-warning`
- **Error:** `#D32F2F` (dark: `#EF4444`) -> `text-status-error`, `bg-status-error`

---

## 3. Typography

Self-hosted locally via `@fontsource-variable` packages; no external Google Fonts requests.

- **Archivo Variable (`@fontsource-variable/archivo/wdth.css`)**:
  - Headings (`h1`–`h6`): heavy weight (`font-weight: 700`), condensed width (`font-stretch: 85%`) evoking cinematic film credit lettering.
  - UI text: normal width (`font-stretch: 100%`).
- **Source Serif 4 (`@fontsource-variable/source-serif-4`)**:
  - Long reading text only (bios, full job descriptions, legal pages) with 1.65 line-height.
- **Strict 8-Step Scale:**
  1. `12px` (`text-12`, line-height `16px`) — Captions, timestamps, metadata
  2. `14px` (`text-14`, line-height `20px`) — Compact row details, table cells, secondary controls
  3. `16px` (`text-16`, line-height `24px`) — Body text
  4. `18px` (`text-18`, line-height `26px`) — Sub-section titles, dialog headings
  5. `22px` (`text-22`, line-height `28px`) — Section titles
  6. `28px` (`text-28`, line-height `34px`) — Page titles
  7. `40px` (`text-40`, line-height `46px`) — Hero subheadings
  8. `56px` (`text-56`, line-height `62px`) — Primary hero titles
- **Tabular Figures (`tnum` / `[data-tnum="true"]`):** Applied across all match scores, currencies, dates, and hours.
- **Voice Guidelines:** Sentence case everywhere. Plain verbs. No all-caps badges or decorative arrow icons on buttons.

---

## 4. Geometry & Elevation

- **Functional Border Radii:**
  - `3px` (`rounded-sm`, `rounded-btn`, `rounded-input`, `rounded-row`): Data rows, tables, inputs, buttons, cards.
  - `10px` (`rounded-lg`, `rounded-modal`, `rounded-sheet`): Modals, sheets, floating panels.
- **Single Soft Floating Shadow:**
  - `shadow-floating` (`0 8px 30px rgba(14, 27, 46, 0.12)` in light mode; `rgba(0,0,0,0.45)` in dark mode).
  - Used strictly for floating objects (modals, dropdown menus, sheets, toasts). In-page cards and data rows are flat with `border-line` borders only.

---

## 5. UI Component Library (`client/src/components/ui/`)

All components are fully typed, keyboard-navigable, and accessible.

| Component | Path | Description & Props |
|---|---|---|
| `Button` | `Button.tsx` | Variants: `primary` (Tungsten fill), `secondary` (Surface + Line), `ghost`, `danger`. Sizes: `sm`, `md`, `lg`. `loading` state renders spinner and sets `aria-busy="true"`. |
| `Input` | `Input.tsx` | 3px radius input with `border-line` and focus states. Supports `error` state (`aria-invalid="true"`). |
| `Textarea` | `Textarea.tsx` | Multi-line text field matching `Input` tokens and states. |
| `Select` | `Select.tsx` | Styled select with custom chevron indicator and accessible keyboard focus. |
| `Checkbox` | `Checkbox.tsx` | Accessible checkbox with 3px radius box, check icon, and optional label/description. |
| `Field` | `Field.tsx` | Form control wrapper providing `label`, `required` indicator, `hint`, and `error` (with `role="alert"`). |
| `Badge` | `Badge.tsx` | 3px radius status and metadata pills: `neutral`, `tungsten`, `success`, `warning`, `error`. |
| `DepartmentMark` | `DepartmentMark.tsx` | Signature gel color dot + department label for camera, sound, editing, art & costume, cast, production. |
| `Tabs` | `Tabs.tsx` | WAI-ARIA tab pattern (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`) with keyboard navigation. |
| `Modal` | `Modal.tsx` | Floating dialog with 10px radius, `shadow-floating`, focus trap, Esc key listener, and focus return. |
| `Sheet` | `Sheet.tsx` | Mobile sliding drawer (top, bottom, left, right) with 10px radius and backdrop overlay. |
| `Toast` | `Toast.tsx` | Sonner wrapper styled to the CineConnect token palette (`showToast.success`, `error`, `info`). |
| `Skeleton` | `Skeleton.tsx` | Quiet, non-distracting loading placeholders (`text`, `rect`, `circle`). |
| `EmptyState` | `EmptyState.tsx` | Non-apologetic empty state with concise title, explanation, and clear single next action button. |
| `DataTable` / `DataRow` | `DataTable.tsx` | Dense comparative rows for lists (jobs, applicants, talent) with clear columns and tabular figures. |
| `Avatar` | `Avatar.tsx` | Square (3px) or circular avatar with image support and initial monogram fallback. |
| `Pagination` / `LoadMore` | `Pagination.tsx` | Compact page controls (`Showing X–Y of Z items`) and load more button. |
| `Tooltip` | `Tooltip.tsx` | Accessible Radix tooltip with 3px radius and delay timing. |

---

## 6. Signature Component: `LightMeter`

```tsx
import { LightMeter } from '@/components/ui'

<LightMeter
  score={82}
  breakdown={[
    { name: 'Skills match', score: 28, maxScore: 30, reason: '4 of 4 skills match' },
    { name: 'Role alignment', score: 20, maxScore: 20 },
    { name: 'Experience', score: 14, maxScore: 15 },
    { name: 'Language', score: 10, maxScore: 10 },
    { name: 'Location', score: 10, maxScore: 10 },
    { name: 'Completeness', score: 10, maxScore: 10 },
    { name: 'Recency', score: 5, maxScore: 5 },
  ]}
  size="md"
  label="Director of Photography match"
/>
```

- **Exposure Scale Anatomy:**
  - 0–100 horizontal track with tick marks (major notches every 25 points, minor ticks throughout).
  - Tungsten needle (`#F2A33A`) indicator accurately placed along the scale track.
  - Settle transition: needle animates with a 500ms easing transition **only when the score changes after initial mount** (static on mount; respects `prefers-reduced-motion`).
- **Accessibility:**
  - `role="meter"`
  - `aria-valuenow={score}`
  - `aria-valuemin={0}`
  - `aria-valuemax={100}`
  - `aria-label="Match score 82 out of 100"`
  - Screen-reader text alternative: `<span className="sr-only">Match score 82 out of 100</span>`.
- **Breakdown Inspection:**
  - Expandable toggle button (`aria-expanded`) exposing evaluation per signal.
  - Each signal shows name, weight contribution, achieved points, mini progress bar, and descriptive reason.
