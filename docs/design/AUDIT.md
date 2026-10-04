# CineConnect — Frontend UI & Design System Audit

**Date:** October 2026  
**Context:** Baseline visual audit of `client/src/pages` (26 pages) and shared components (6 components) prior to redesign implementation. Screenshots captured via Playwright at mobile (390px) and desktop (1280px) viewports in `docs/design/before/`.

---

## 1. Inventory of Audited Views

### 1.1 Pages (`client/src/pages`)
| Page | Route | Viewports Captured |
|---|---|---|
| Landing | `/` | 390px, 1280px |
| Login | `/login` | 390px, 1280px |
| Register | `/register` | 390px, 1280px |
| Verify | `/verify` | 390px, 1280px |
| ResetPassword | `/reset-password` | 390px, 1280px |
| Privacy | `/privacy` | 390px, 1280px |
| Terms | `/terms` | 390px, 1280px |
| Cookies | `/cookies` | 390px, 1280px |
| Contact | `/contact` | 390px, 1280px |
| Unsubscribe | `/unsubscribe/:token` | 390px, 1280px |
| NotFound | `/404` | 390px, 1280px |
| BrowseJobs | `/jobs` | 390px, 1280px |
| CompanyDetail | `/company/:id` | 390px, 1280px |
| Home | `/home` | 390px, 1280px |
| CreateProfile | `/create-profile` | 390px, 1280px |
| CreateJob | `/jobs/create` | 390px, 1280px |
| EditJob | `/jobs/:id/edit` | 390px, 1280px |
| JobDetail | `/jobs/:id` | 390px, 1280px |
| Applications | `/applications` | 390px, 1280px |
| Search | `/search` | 390px, 1280px |
| Chat | `/chat` | 390px, 1280px |
| Profile | `/profile` | 390px, 1280px |
| Settings | `/settings` | 390px, 1280px |
| Admin | `/admin` | 390px, 1280px |
| Alerts | `/alerts` | 390px, 1280px |
| SavedJobs | `/saved-jobs` | 390px, 1280px |

### 1.2 Shared Components (`client/src/components`)
| Component | Audit Source | Viewports Captured |
|---|---|---|
| `AutocompleteInput` | `#comp-autocomplete-input` | 390px, 1280px |
| `AutocompleteTagInput` | `#comp-autocomplete-tag-input` | 390px, 1280px |
| `NotificationBell` | `#comp-notification-bell` | 390px, 1280px |
| `VerifiedBadge` | `#comp-verified-badge` | 390px, 1280px |
| `ProtectedRoute` (Loader) | `#comp-protected-route-loader` | 390px, 1280px |
| `PublicFooter` | `#comp-public-footer` | 390px, 1280px |

---

## 2. Key Inconsistencies & Issues Found

### 2.1 Spacing & Grid System
- **Inconsistent Page Gutters:** Pages toggle arbitrarily between `px-4`, `px-6`, `px-8`, and `max-w-5xl`, `max-w-6xl`, `max-w-7xl` without a coherent layout rhythm.
- **Card Padding Disparities:** Auth screens use `p-8` (`.auth-card`), while settings and profile panels use `p-6` or `p-4`, and application candidate rows use `p-5` with uneven vertical gaps (`space-y-4` vs `gap-6`).
- **Data Densities:** Job listings in `BrowseJobs` and applications in `Applications` are laid out as puffy isolated cards (`rounded-xl p-5 mb-4`) rather than compact, scannable data rows and structured tables required for comparison in a production office.

### 2.2 Typography & Type Scale
- **External Dependency & Privacy Violation:** External Google Fonts link (`https://fonts.googleapis.com/...`) loaded in `index.html` and `@import` in `index.css`, violating CSP and privacy guarantees.
- **Missing Film-Set Typography:** No Archivo (variable condensed-to-normal headline font) or Source Serif 4 (for bios, reading text). Generic Inter was applied globally across all headings and body.
- **Non-Conforming Type Scale:** Fragmented font sizes scattered across classes: `text-[11px]`, `text-2xs`, `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`, `text-5xl` with loose line heights instead of the brief's fixed 8-step scale (12, 14, 16, 18, 22, 28, 40, 56 px).
- **All-Caps & Stylistic Chrome:** All-caps labels (`tracking-wider uppercase text-xs`) and eyebrow labels above headings appear across multiple pages, contrary to the brief's strict sentence-case rule.

### 2.3 Button Styles & Radii
- **Multiple Competing Button Classes:** `index.css` defines `.btn-primary` (electric blue `#1F6FEB`), `.btn-navy` (`#0B2545`), `.btn-ghost`, and `.btn-outline`, alongside ad-hoc inline classes (`bg-blue-600 hover:bg-blue-700`, `bg-emerald-600`, etc.).
- **Arbitrary Border Radii:** Radii vary wildly: `rounded-btn` (7px), `rounded-lg` (8px), `rounded-xl` (12px), `rounded-2xl` (16px), `rounded-full` (pills). The redesign mandates a strict 2-tier functional radius:
  - **3px:** data rows, inputs, buttons, table items
  - **10px:** modals, sheets, floating panels
- **Superfluous Button Chrome:** Buttons frequently incorporate trailing arrow icons (`ArrowRight`, `ChevronRight`) which add decorative noise.

### 2.4 Colours Outside Design Tokens
- **Absence of Film Set Brand Tokens:**
  - Background is generic pure white (`#FFFFFF`) or off-white (`#F5F7FA`) instead of **Paper** (`#EEF1F4`).
  - Text and headers use varying slate tones (`#1A1A2E`, `#0B2545`, `#475569`) instead of **Ink** (`#0E1B2E`) and **Muted** (`#5A6A7E`).
  - Dividers use `#E2E8F0` / `#CBD5E1` instead of **Line** (`#D5DBE3`).
  - CTA accents use electric corporate SaaS blue (`#1F6FEB`) instead of warm **Tungsten** (`#F2A33A`) fill.
- **Department Colour Coding Missing:** Roles and skills currently lack gel colour-coding (`Camera #2F6FDE`, `Sound #7A4FD1`, `Editing #12968A`, `Art & Costume #D14B6F`, `Cast #D98A1F`, `Production #5B6B7F`), making quick scanning impossible.
- **No Dark Mode System:** Dark mode CSS variables and theme mappings are absent.

### 2.5 Component Duplication & Accessibility Gaps
- **Form Controls:** `<input>`, `<textarea>`, and `<select>` elements are re-implemented in every single page file with diverging focus rings and border colors.
- **Missing Accessible Primitives:**
  - Modals lack focus traps, Escape key dismissal, and return-of-focus to the triggering element.
  - Tabs are implemented with plain div toggles without WAI-ARIA `role="tab"`, `role="tablist"`, or arrow key navigation.
  - Lack of accessible tooltip wrappers, sheets, and standardized field error messaging.
- **Match Score Presentation:** The match score (0–100) is shown as a generic percentage text badge (`92%`) without the signature horizontal **LightMeter** exposure scale.

---

## 3. Redesign Action Plan

1. **Tokens & Theme Architecture:** Implement CSS custom properties for light/dark mode (`--ink`, `--paper`, `--surface`, `--tungsten`, `--line`, `--muted`, and 6 department gels). Map into `tailwind.config.js` and eliminate deprecated tokens.
2. **Self-Hosted Typography:** Import `@fontsource-variable/archivo` and `@fontsource-variable/source-serif-4` in `main.tsx` / `index.css`, strip all Google Fonts CDN links from `index.html` and `index.css`, and set up CSS font preloading.
3. **Unified Accessible UI Library (`client/src/components/ui/`):**
   - `Button` (primary [Tungsten], secondary, ghost, danger, loading spinner)
   - `Input`, `Textarea`, `Select`, `Checkbox`, `Field` (label, hint, error)
   - `Badge`, `DepartmentMark` (gel dot + label)
   - `Tabs` (accessible, keyboard-friendly)
   - `Modal` (Radix Dialog with focus trap, Esc, return-focus) & `Sheet` (mobile sliding drawer)
   - `Toast` (Sonner wrapper styled to token system)
   - `Skeleton`, `EmptyState`, `DataTable` & `DataRow` (3px radius dense row format)
   - `Avatar`, `Pagination` / `LoadMore`, `Tooltip` (Radix Tooltip)
4. **Signature `LightMeter` Component:** 0–100 exposure tick-mark scale, Tungsten needle, smooth value transition on change, accessible `role="meter"` with ARIA attributes and expandable signal breakdown.
5. **Component Review Route (`/design`):** DEV-only showcase rendering every UI component in all possible states in both light and dark modes.
6. **Testing & Validation:** Unit and rendering tests with Vitest + Testing Library, full TypeScript validation, and comprehensive documentation in `docs/design/TOKENS.md`.
