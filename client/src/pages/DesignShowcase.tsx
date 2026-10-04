import { useState } from 'react'
import {
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  Field,
  Badge,
  DepartmentMark,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Modal,
  ModalTrigger,
  ModalContent,
  Sheet,
  SheetTrigger,
  SheetContent,
  showToast,
  Skeleton,
  EmptyState,
  DataTable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  DataRow,
  Avatar,
  Pagination,
  LoadMore,
  Tooltip,
  LightMeter,
  Signal,
} from '../components/ui'
import { Film, Briefcase, Moon, Sun } from 'lucide-react'

const MOCK_SIGNALS: Signal[] = [
  { name: 'Skills match', score: 28, maxScore: 30, reason: '4 of 4 required skills match: ARRI Alexa, Lighting, Color Theory, Anamorphic' },
  { name: 'Role alignment', score: 20, maxScore: 20, reason: 'Primary role directly matches Director of Photography' },
  { name: 'Experience depth', score: 14, maxScore: 15, reason: '9 years verified experience (minimum requirement: 4 years)' },
  { name: 'Language compatibility', score: 10, maxScore: 10, reason: 'Fluent in Hindi, English, and Marathi' },
  { name: 'Location match', score: 10, maxScore: 10, reason: 'Based in Mumbai (local shoot)' },
  { name: 'Profile completeness', score: 10, maxScore: 10, reason: '100% complete with IMDB and showreel verified' },
  { name: 'Recency of credits', score: 5, maxScore: 5, reason: 'Active feature release in 2024' },
]

export default function DesignShowcase() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [meterScore, setMeterScore] = useState(82)
  const [inputValue, setInputValue] = useState('ARRI Alexa Mini LF')
  const [textareaValue, setTextareaValue] = useState('20-day feature shoot in Mumbai. Must have experience with high-contrast night exteriors.')
  const [checkboxChecked, setCheckboxChecked] = useState(true)
  const [page, setPage] = useState(1)
  const [loadMoreLoading, setLoadMoreLoading] = useState(false)

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    if (next === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.removeAttribute('data-theme')
    }
  }

  return (
    <div className={`min-h-screen bg-paper text-ink transition-colors ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Top sticky review bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-sm bg-ink flex items-center justify-center text-surface">
            <Film size={14} />
          </div>
          <span className="font-bold text-16 tracking-tight">CineConnect Design System Review</span>
          <Badge variant="tungsten" size="sm">DEV ONLY</Badge>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-12 text-muted">Theme: <strong className="text-ink uppercase">{theme}</strong></span>
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-16">

        {/* ── 1. Tokens & Color Palette ──────────────────────── */}
        <section className="space-y-4">
          <div className="border-b border-line pb-2">
            <h2 className="text-22 font-bold text-ink">1. Film-Set Tokens</h2>
            <p className="text-14 text-muted">Core brand surfaces, tungsten highlight, lines, and department gels.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="p-3 bg-surface border border-line rounded-sm space-y-1.5">
              <div className="w-full h-12 rounded-[2px] bg-ink border border-line" />
              <div className="font-medium text-14">Ink</div>
              <div className="text-12 text-muted font-mono">#0E1B2E</div>
              <div className="text-12 text-muted">Text, nav rail, dark BG</div>
            </div>

            <div className="p-3 bg-surface border border-line rounded-sm space-y-1.5">
              <div className="w-full h-12 rounded-[2px] bg-paper border border-line" />
              <div className="font-medium text-14">Paper</div>
              <div className="text-12 text-muted font-mono">#EEF1F4</div>
              <div className="text-12 text-muted">App background</div>
            </div>

            <div className="p-3 bg-surface border border-line rounded-sm space-y-1.5">
              <div className="w-full h-12 rounded-[2px] bg-surface border border-line" />
              <div className="font-medium text-14">Surface</div>
              <div className="text-12 text-muted font-mono">#FFFFFF</div>
              <div className="text-12 text-muted">Panels, rows, forms</div>
            </div>

            <div className="p-3 bg-surface border border-line rounded-sm space-y-1.5">
              <div className="w-full h-12 rounded-[2px] bg-tungsten border border-line" />
              <div className="font-medium text-14 text-ink">Tungsten</div>
              <div className="text-12 text-muted font-mono">#F2A33A</div>
              <div className="text-12 text-muted">Action fill, needle</div>
            </div>

            <div className="p-3 bg-surface border border-line rounded-sm space-y-1.5">
              <div className="w-full h-12 rounded-[2px] bg-line border border-line/80" />
              <div className="font-medium text-14">Line</div>
              <div className="text-12 text-muted font-mono">#D5DBE3</div>
              <div className="text-12 text-muted">Dividers, borders</div>
            </div>

            <div className="p-3 bg-surface border border-line rounded-sm space-y-1.5">
              <div className="w-full h-12 rounded-[2px] bg-muted border border-line" />
              <div className="font-medium text-14">Muted</div>
              <div className="text-12 text-muted font-mono">#5A6A7E</div>
              <div className="text-12 text-muted">Secondary text</div>
            </div>
          </div>

          <div className="pt-2">
            <h3 className="text-14 font-semibold text-muted mb-2">Department Lighting Gels</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="p-3 bg-surface border border-line rounded-sm flex items-center gap-2">
                <DepartmentMark department="camera" />
              </div>
              <div className="p-3 bg-surface border border-line rounded-sm flex items-center gap-2">
                <DepartmentMark department="sound" />
              </div>
              <div className="p-3 bg-surface border border-line rounded-sm flex items-center gap-2">
                <DepartmentMark department="editing" />
              </div>
              <div className="p-3 bg-surface border border-line rounded-sm flex items-center gap-2">
                <DepartmentMark department="art and costume" />
              </div>
              <div className="p-3 bg-surface border border-line rounded-sm flex items-center gap-2">
                <DepartmentMark department="cast" />
              </div>
              <div className="p-3 bg-surface border border-line rounded-sm flex items-center gap-2">
                <DepartmentMark department="production" />
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Typography Scale ────────────────────────────── */}
        <section className="space-y-4">
          <div className="border-b border-line pb-2">
            <h2 className="text-22 font-bold text-ink">2. Typography (8-Step Scale)</h2>
            <p className="text-14 text-muted">Archivo for UI & headlines (condensed-to-normal); Source Serif 4 for long reading text.</p>
          </div>

          <div className="p-5 bg-surface border border-line rounded-sm space-y-4">
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-56 font-bold tracking-tight leading-none">56px Feature shoot</span>
              <span className="text-12 font-mono text-muted">56px / 62px</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-40 font-bold tracking-tight">40px Production Office</span>
              <span className="text-12 font-mono text-muted">40px / 46px</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-28 font-bold">28px Cinematographer Roster</span>
              <span className="text-12 font-mono text-muted">28px / 34px</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-22 font-bold">22px Principal Photography Call Sheet</span>
              <span className="text-12 font-mono text-muted">22px / 28px</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-18 font-medium">18px Sound Designer / Foley Artist</span>
              <span className="text-12 font-mono text-muted">18px / 26px</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-16 font-normal">16px Body: Match score evaluates 7 signals across skills and verification</span>
              <span className="text-12 font-mono text-muted">16px / 24px (Body)</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-14 font-normal">14px Compact row details, table cells, secondary controls</span>
              <span className="text-12 font-mono text-muted">14px / 20px</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-12 font-normal text-muted">12px Captions, metadata, tick labels, timestamps</span>
              <span className="text-12 font-mono text-muted">12px / 16px</span>
            </div>

            <div className="mt-4 p-4 bg-paper rounded-sm border border-line">
              <div className="text-12 font-semibold text-muted mb-1 uppercase tracking-wider">Source Serif 4 (Long Reading Text)</div>
              <p className="reading-text text-16 text-ink max-w-2xl">
                The director of photography oversees the camera and lighting departments, translating the screenplay's visual themes into framed shots, colour palettes, and lighting setups. On this production, principal photography spans twenty consecutive days across live locations in Mumbai and coastal sets in Goa.
              </p>
            </div>
          </div>
        </section>

        {/* ── 3. Signature Component: LightMeter ─────────────── */}
        <section className="space-y-4">
          <div className="border-b border-line pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-22 font-bold text-ink">3. Signature Component: LightMeter</h2>
              <p className="text-14 text-muted">Horizontal exposure scale (0–100) with tick marks, Tungsten needle, and 7-signal breakdown.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMeterScore(Math.max(0, meterScore - 10))}
              >
                -10 score
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMeterScore(Math.min(100, meterScore + 10))}
              >
                +10 score
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Interactive Live LightMeter with Breakdown */}
            <div className="p-5 bg-surface border border-line rounded-sm space-y-4">
              <div className="text-14 font-semibold text-ink">Interactive Match Preview (Size: LG)</div>
              <LightMeter
                score={meterScore}
                breakdown={MOCK_SIGNALS}
                size="lg"
                label="Director of Photography match"
              />
              <p className="text-12 text-muted">
                Needle transitions with smooth settling when score updates. Hover over or toggle signal rows below to inspect weights and reasons.
              </p>
            </div>

            {/* Various Static Score States */}
            <div className="p-5 bg-surface border border-line rounded-sm space-y-4">
              <div className="text-14 font-semibold text-ink">States across Sizes (sm, md, lg)</div>
              <div className="space-y-4">
                <LightMeter score={24} size="sm" label="Low match (24/100)" />
                <LightMeter score={65} size="md" label="Moderate match (65/100)" />
                <LightMeter score={98} size="md" label="Exceptional match (98/100)" />
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. Buttons ─────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="border-b border-line pb-2">
            <h2 className="text-22 font-bold text-ink">4. Buttons</h2>
            <p className="text-14 text-muted">Active voice verbs, 3px radius, tungsten primary fill, no trailing arrows.</p>
          </div>

          <div className="p-5 bg-surface border border-line rounded-sm space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary">Apply to this job</Button>
              <Button variant="secondary">Save for later</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="danger">Withdraw application</Button>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-line">
              <div className="text-12 text-muted w-full">Button Sizes: sm, md, lg</div>
              <Button variant="primary" size="sm">Small action</Button>
              <Button variant="primary" size="md">Medium action</Button>
              <Button variant="primary" size="lg">Large action</Button>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-line">
              <div className="text-12 text-muted w-full">States: Loading, Disabled</div>
              <Button variant="primary" loading>Publishing job</Button>
              <Button variant="secondary" loading>Submitting</Button>
              <Button variant="primary" disabled>Publish job</Button>
              <Button variant="secondary" disabled>Edit requirements</Button>
            </div>
          </div>
        </section>

        {/* ── 5. Form Controls ───────────────────────────────── */}
        <section className="space-y-4">
          <div className="border-b border-line pb-2">
            <h2 className="text-22 font-bold text-ink">5. Form Controls & Field Wrapper</h2>
            <p className="text-14 text-muted">3px radius, Line borders, Ink text, accessible error & hint bindings.</p>
          </div>

          <div className="p-5 bg-surface border border-line rounded-sm grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Field label="Camera package" hint="Specify camera body and mount" required htmlFor="f-camera">
                <Input
                  id="f-camera"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="e.g. ARRI Alexa 35"
                />
              </Field>

              <Field label="Job title with error" error="Title must be at least 5 characters" htmlFor="f-error">
                <Input id="f-error" error="Title must be at least 5 characters" defaultValue="Dir" />
              </Field>

              <Field label="Shoot location" htmlFor="f-select">
                <Select id="f-select" defaultValue="mumbai">
                  <option value="mumbai">Mumbai, Maharashtra</option>
                  <option value="hyderabad">Hyderabad, Telangana</option>
                  <option value="chennai">Chennai, Tamil Nadu</option>
                </Select>
              </Field>
            </div>

            <div className="space-y-4">
              <Field label="Shooting brief" hint="Describe shooting days, conditions, and special equipment" htmlFor="f-brief">
                <Textarea
                  id="f-brief"
                  value={textareaValue}
                  onChange={(e) => setTextareaValue(e.target.value)}
                  rows={3}
                />
              </Field>

              <div className="pt-2 space-y-3">
                <Checkbox
                  label="Verified credits required"
                  description="Only applicants with at least 2 verified production house credits"
                  checked={checkboxChecked}
                  onChange={(e) => setCheckboxChecked(e.target.checked)}
                />
                <Checkbox
                  label="Disabled checkbox"
                  description="This requirement is locked by contract"
                  disabled
                  checked={false}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. Modals, Sheets & Overlays ───────────────────── */}
        <section className="space-y-4">
          <div className="border-b border-line pb-2">
            <h2 className="text-22 font-bold text-ink">6. Overlays (Modal, Sheet, Tooltip, Toast)</h2>
            <p className="text-14 text-muted">10px radius on floating surfaces, single soft shadow, accessible focus trap.</p>
          </div>

          <div className="p-5 bg-surface border border-line rounded-sm flex flex-wrap items-center gap-4">
            {/* Modal Dialog */}
            <Modal>
              <ModalTrigger asChild>
                <Button variant="secondary">Open modal dialog</Button>
              </ModalTrigger>
              <ModalContent
                title="Publish job requisition"
                description="This job will immediately appear on the talent marketplace and notify candidates with match score >= 75%."
              >
                <div className="space-y-3 py-2">
                  <Field label="Confirmation note">
                    <Input placeholder="Ready for review by line producer" />
                  </Field>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="primary" onClick={() => showToast.success('Job published')}>
                    Publish job
                  </Button>
                </div>
              </ModalContent>
            </Modal>

            {/* Mobile Sheet Drawer */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary">Open mobile drawer (Sheet)</Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                title="Candidate detail"
                description="Review match signals and production history."
              >
                <div className="space-y-4 py-4">
                  <LightMeter score={92} size="md" />
                  <div className="text-14 text-ink">
                    <strong className="block mb-1">Recent film credits:</strong>
                    <ul className="list-disc list-inside text-12 text-muted space-y-1">
                      <li>Shadows in the Mist (2024) — DP</li>
                      <li>Bombay Velvet Dreams (2023) — Steadicam</li>
                    </ul>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Tooltip */}
            <Tooltip content="Match score combines 7 signals into a 0-100 score">
              <Button variant="ghost">Hover for tooltip</Button>
            </Tooltip>

            {/* Toast Triggers */}
            <div className="flex items-center gap-2 pl-4 border-l border-line">
              <span className="text-12 text-muted">Toasts:</span>
              <Button variant="secondary" size="sm" onClick={() => showToast.success('Job published')}>
                Success toast
              </Button>
              <Button variant="secondary" size="sm" onClick={() => showToast.error('Application submission failed')}>
                Error toast
              </Button>
              <Button variant="secondary" size="sm" onClick={() => showToast.info('Candidate invited to chat')}>
                Info toast
              </Button>
            </div>
          </div>
        </section>

        {/* ── 7. Data Display (Tables, Rows, Badges, Avatars) ── */}
        <section className="space-y-4">
          <div className="border-b border-line pb-2">
            <h2 className="text-22 font-bold text-ink">7. Dense Data Presentation (Rows & Tables)</h2>
            <p className="text-14 text-muted">Comparative rows with 3px radius, clear columns, tabular figures.</p>
          </div>

          <div className="space-y-4">
            <DataTable>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Match score</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Avatar fallback="Aditya Roy" size="sm" />
                      <span>Aditya Roy</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DepartmentMark department="camera" size="sm" />
                  </TableCell>
                  <TableCell>Cinematographer</TableCell>
                  <TableCell>
                    <div className="w-32">
                      <LightMeter score={92} size="sm" showScoreLabel={false} />
                    </div>
                  </TableCell>
                  <TableCell>9 years</TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="sm">Move to interview</Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Avatar fallback="Neha Sharma" size="sm" />
                      <span>Neha Sharma</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DepartmentMark department="sound" size="sm" />
                  </TableCell>
                  <TableCell>Sound Designer</TableCell>
                  <TableCell>
                    <div className="w-32">
                      <LightMeter score={78} size="sm" showScoreLabel={false} />
                    </div>
                  </TableCell>
                  <TableCell>6 years</TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="sm">Move to interview</Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </DataTable>

            {/* Standalone DataRow */}
            <DataRow clickable>
              <div className="flex items-center gap-3">
                <DepartmentMark department="editing" />
                <span className="font-semibold text-14">Lead Film Editor — Mumbai Feature Shoot</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="tungsten">3 active applicants</Badge>
                <span className="text-12 text-muted tnum">Published 2d ago</span>
              </div>
            </DataRow>

            {/* Badges and Avatars */}
            <div className="p-4 bg-surface border border-line rounded-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-12 text-muted mr-1">Badges:</span>
                <Badge variant="neutral">Draft</Badge>
                <Badge variant="tungsten">Open</Badge>
                <Badge variant="success">Shortlisted</Badge>
                <Badge variant="warning">Under review</Badge>
                <Badge variant="error">Rejected</Badge>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-12 text-muted mr-1">Avatars:</span>
                <Avatar fallback="Dharma Pictures" size="sm" />
                <Avatar fallback="Yash Raj" size="md" />
                <Avatar fallback="Excel" size="lg" />
                <Avatar fallback="Rohit" size="xl" shape="circle" />
              </div>
            </div>

            {/* Pagination & LoadMore */}
            <div className="p-4 bg-surface border border-line rounded-sm space-y-4">
              <Pagination
                currentPage={page}
                totalPages={5}
                totalItems={42}
                itemsPerPage={10}
                onPageChange={setPage}
              />
              <div className="pt-3 border-t border-line">
                <LoadMore
                  hasMore={true}
                  totalItems={42}
                  currentCount={20}
                  loading={loadMoreLoading}
                  onLoadMore={() => {
                    setLoadMoreLoading(true)
                    setTimeout(() => setLoadMoreLoading(false), 1000)
                  }}
                />
              </div>
            </div>

            {/* Accessible Tabs Showcase */}
            <div className="p-4 bg-surface border border-line rounded-sm space-y-3">
              <h3 className="text-14 font-semibold text-ink">Tabs (WAI-ARIA with Arrow Key Navigation)</h3>
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="applicants">Applicants (14)</TabsTrigger>
                  <TabsTrigger value="callsheet">Call sheet</TabsTrigger>
                  <TabsTrigger value="contract" disabled>Contract (Locked)</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <p className="text-14 text-muted pt-2">Shoot location: Mehboob Studio, Bandra. 12 shooting days scheduled.</p>
                </TabsContent>
                <TabsContent value="applicants">
                  <p className="text-14 text-muted pt-2">14 candidates scored via matchScore. Top match: 92% (Aditya Roy).</p>
                </TabsContent>
                <TabsContent value="callsheet">
                  <p className="text-14 text-muted pt-2">Call time 06:00 IST. Equipment truck arrives 05:30.</p>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </section>

        {/* ── 8. Empty States & Skeletons ────────────────────── */}
        <section className="space-y-4">
          <div className="border-b border-line pb-2">
            <h2 className="text-22 font-bold text-ink">8. Quiet States (Skeleton & EmptyState)</h2>
            <p className="text-14 text-muted">Quiet, non-apologetic states with clear next actions.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <EmptyState
              icon={<Briefcase size={28} />}
              title="No applications received yet"
              description="This job was published today. Candidates matching role and skill criteria will appear here."
              actionLabel="Share job listing"
              onAction={() => showToast.info('Listing link copied to clipboard')}
            />

            <div className="p-5 bg-surface border border-line rounded-sm space-y-3">
              <div className="text-14 font-semibold text-ink">Skeleton Loading Placeholder</div>
              <div className="flex items-center gap-3">
                <Skeleton variant="circle" className="w-10 h-10" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton variant="text" className="h-4 w-1/3" />
                  <Skeleton variant="text" className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton variant="rect" className="h-16 w-full" />
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
