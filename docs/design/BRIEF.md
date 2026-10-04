# CineConnect — Frontend Design Brief

Source of truth for the redesign. Read fully before any UI work.

### The idea
Most marketplaces look like marketplaces. CineConnect's world is the **film set**, where work runs on call sheets, schedules, shot lists, lighting gels and light meters. The interface should feel like a well-run production office: dense where people work, quiet everywhere else, and instantly legible.

Two ideas carry the design, and everything else stays disciplined around them:

1. **The light meter.** The 0 to 100 match score is your differentiator, so it gets a signature visual: a horizontal exposure scale with tick marks and a needle, not a generic percentage ring or progress bar. It appears on job detail (score preview), the applicant pipeline, and comparison. Nothing else on the site is this expressive.
2. **Gel colour-coding by department.** Camera, sound, editing, art and costume, cast, and production each get one fixed colour (named after lighting gels). It is used only as information: a small marker beside roles and skills so people can scan a list by department. Never decoration.

### Tokens

| Token | Value | Use |
|---|---|---|
| Ink | `#0E1B2E` | Text, nav rail, hero surfaces (keeps your navy brand identity) |
| Paper | `#EEF1F4` | App background (cool grey-white, deliberately not cream) |
| Surface | `#FFFFFF` | Panels, rows, forms |
| Tungsten | `#F2A33A` | Primary action fill, the meter needle, one highlight per screen. Fill only; never text on white |
| Line | `#D5DBE3` | Dividers, input borders |
| Muted | `#5A6A7E` | Secondary text (checked for AA contrast on Paper) |

Department gels: camera `#2F6FDE`, sound `#7A4FD1`, editing `#12968A`, art and costume `#D14B6F`, cast `#D98A1F`, production `#5B6B7F`. Status colours (success, warning, error) are separate and used only for status.

Dark mode: Ink as background, Surface becomes `#16263D`, Paper becomes `#0A1424`. Build it with CSS variables from day one.

### Type
- **Archivo** (variable, with the width axis) for headings and UI. Headlines use a condensed-to-normal width (like film-credit lettering) at heavy weight; UI text uses normal width. Tabular figures on for all scores, dates, and pay.
- **Source Serif 4** for long reading text only (bios, job descriptions, legal pages). Serif body gets slightly more line-height than the sans.
- Scale: 12, 14, 16, 18, 22, 28, 40, 56 px. Body 16. Line length under 75 characters. Sentence case everywhere.
- Avoid: one accented word in a headline, ALL-CAPS labels, small labels above every heading, middle-dot strings, arrows on every button.

### Layout
- **Signed-in app:** a slim left rail (icons plus labels on desktop, bottom tab bar on mobile) instead of a top navbar. Work happens in a main column with an optional right context panel.
- **Content is rows and tables, not a wall of identical cards.** Lists (jobs, applicants, talent) are dense rows with clear columns, because users compare things. Use cards only where an item is a standalone object.
- Left-aligned text throughout. Radius: 3px on data rows and inputs, 10px on modals and sheets, so radius means something.
- Borders and dividers show structure only (a table header, a panel edge). One soft shadow style, used for floating things only (menus, modals).

### Landing page hero (the most characteristic moment)
Not a stat banner. The hero is a **live miniature of the product**: a job card ("Cinematographer, 12-day feature shoot, Mumbai") on the left; on the right three anonymous candidate rows sliding into rank order as their light meters settle. It plays once on load, then stays still. Headline beside it states the job to be done in plain words.

### Motion
One orchestrated moment (the hero). Everything else responds to user action: modals open, rows expand, a status change confirms. Respect `prefers-reduced-motion`.

### Voice
Plain verbs, sentence case, active voice. Buttons say what happens ("Apply to this job", "Move to interview", "Publish job"); the toast repeats the same verb ("Job published"). Errors say what went wrong and what to do, never apologise. Empty screens give one clear next action.

### Review against the generic defaults
- Cream plus terracotta serif: avoided (cool paper, grotesque display, amber only as an action fill).
- Near-black plus acid accent: avoided on app screens (light by default; dark is a theme, not the identity).
- SaaS card kit with one radius and identical shadows: avoided (rows, tables, meaningful radius).
- Template chrome (caps eyebrows, middle dots, arrows): banned in the prompts below.
- Memorable thing: the light meter. Everything else stays quiet.

