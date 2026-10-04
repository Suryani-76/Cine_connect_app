import { useState } from 'react'
import { AutocompleteInput } from '../components/AutocompleteInput'
import { AutocompleteTagInput } from '../components/AutocompleteTagInput'
import { NotificationBell } from '../components/NotificationBell'
import { PublicFooter } from '../components/PublicFooter'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { Film } from 'lucide-react'

export default function AuditComponents() {
  const [role, setRole] = useState('Cinematographer')
  const [tags, setTags] = useState(['Steadicam', 'ARRI Alexa', 'Color Grading'])

  return (
    <div className="min-h-screen bg-surface-base p-6 space-y-10">
      <h1 className="text-2xl font-bold">Shared Components Audit Showcase</h1>

      <div id="comp-autocomplete-input" className="p-4 bg-white rounded-xl border border-surface-border">
        <h2 className="text-sm font-semibold text-content-secondary mb-2">AutocompleteInput</h2>
        <AutocompleteInput
          label="Role Selection"
          value={role}
          onChange={setRole}
          type="roles"
          placeholder="Search role..."
        />
      </div>

      <div id="comp-autocomplete-tag-input" className="p-4 bg-white rounded-xl border border-surface-border">
        <h2 className="text-sm font-semibold text-content-secondary mb-2">AutocompleteTagInput</h2>
        <AutocompleteTagInput
          label="Required Skills"
          placeholder="Add skills..."
          tags={tags}
          onChange={setTags}
          type="skills"
        />
      </div>

      <div id="comp-notification-bell" className="p-4 bg-white rounded-xl border border-surface-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-content-secondary">NotificationBell</h2>
        <NotificationBell userId="usr-123" token="mock-token" />
      </div>

      <div id="comp-verified-badge" className="p-4 bg-white rounded-xl border border-surface-border space-y-2">
        <h2 className="text-sm font-semibold text-content-secondary">VerifiedBadge</h2>
        <div className="flex items-center gap-4">
          <VerifiedBadge />
          <VerifiedBadge showText={false} size={18} />
          <VerifiedBadge className="bg-blue-50 text-blue-700 border-blue-200" />
        </div>
      </div>

      <div id="comp-protected-route-loader" className="p-4 bg-white rounded-xl border border-surface-border">
        <h2 className="text-sm font-semibold text-content-secondary mb-2">ProtectedRoute Loader Mock</h2>
        <div className="p-6 bg-surface-section rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Film size={28} className="text-brand mx-auto mb-3 animate-pulse" />
            <div className="w-6 h-6 border-2 border-surface-border border-t-brand rounded-full animate-spin mx-auto" />
          </div>
        </div>
      </div>

      <div id="comp-public-footer" className="p-4 bg-white rounded-xl border border-surface-border">
        <h2 className="text-sm font-semibold text-content-secondary mb-2">PublicFooter</h2>
        <PublicFooter />
      </div>
    </div>
  )
}
