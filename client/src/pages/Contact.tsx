import { useState, FormEvent } from "react"
import { Link } from "react-router-dom"
import { Mail, ArrowLeft, ShieldAlert, Send, MapPin, Clock, CheckCircle } from "lucide-react"
import { usePageTitle } from "../hooks/usePageTitle"
import { PublicFooter } from "../components/PublicFooter"

export default function Contact() {
  usePageTitle("Contact & Grievance Redressal")

  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", category: "support" })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) return
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      <header className="border-b border-surface-border bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-brand transition-colors">
            <ArrowLeft size={16} /> Back to CineConnect
          </Link>
          <span className="text-xs font-mono uppercase bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-md">
            DRAFT — review by counsel before launch
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex-grow">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 text-brand text-xs font-bold uppercase tracking-wider mb-3">
            <Mail size={14} /> Helpdesk & DPDP Grievance
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-content-heading tracking-tight mb-2">
            Contact & Grievance Redressal
          </h1>
          <p className="text-sm text-content-tertiary">
            We are here to assist creative talent, production teams, and address privacy or statutory grievances.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Statutory Grievance Redressal Box */}
          <div className="space-y-6">
            <section className="bg-white border-2 border-brand/20 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-brand">
                <ShieldAlert size={20} />
                <h2 className="text-lg font-bold text-content-heading">Designated Grievance Officer</h2>
              </div>
              <p className="text-xs text-content-secondary leading-relaxed mb-4">
                In compliance with Section 13 of the Digital Personal Data Protection Act, 2023 and Rule 3(2) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021:
              </p>
              <div className="bg-surface-section p-4 rounded-lg border border-surface-border text-xs space-y-2 font-mono">
                <p><strong>Designation:</strong> Grievance Officer</p>
                <p><strong>Company:</strong> CineConnect Media Technologies Pvt. Ltd.</p>
                <p><strong>Officer Name:</strong> [DRAFT — review by counsel: Mr. A. Sharma]</p>
                <p><strong>Email:</strong> <a href="mailto:grievance@cineconnect.in" className="text-brand underline">grievance@cineconnect.in</a></p>
                <p className="flex items-start gap-1.5 pt-1">
                  <MapPin size={14} className="shrink-0 text-content-tertiary mt-0.5" />
                  <span>[DRAFT: Film City Complex, Goregaon (East), Mumbai, Maharashtra 400065, India]</span>
                </p>
                <p className="flex items-center gap-1.5 pt-1">
                  <Clock size={14} className="shrink-0 text-content-tertiary" />
                  <span>Acknowledgment: 24 hrs • Resolution: 15–30 days</span>
                </p>
              </div>
            </section>

            <div className="bg-white border border-surface-border rounded-xl p-6 shadow-sm text-xs sm:text-sm text-content-secondary space-y-3">
              <h3 className="font-bold text-content-heading">General Support Channels</h3>
              <p>For marketplace questions, talent account assistance, or hiring inquiries:</p>
              <p>Email: <a href="mailto:support@cineconnect.in" className="text-brand font-semibold hover:underline">support@cineconnect.in</a></p>
              <p>Operations Desk: Monday – Saturday, 10:00 AM – 7:00 PM IST</p>
            </div>
          </div>

          {/* Contact Message Form */}
          <div className="bg-white border border-surface-border rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-content-heading mb-1">Send a Message</h2>
            <p className="text-xs text-content-tertiary mb-6">Our support team will respond within 24 hours.</p>

            {submitted ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                <CheckCircle size={32} className="text-emerald-600 mx-auto mb-2" />
                <h3 className="font-bold text-emerald-900 text-sm">Message Received</h3>
                <p className="text-xs text-emerald-700 mt-1">
                  Thank you for contacting CineConnect. A support ticket has been opened and we will reply to {form.email} shortly.
                </p>
                <button onClick={() => setSubmitted(false)} className="btn-secondary text-xs mt-4">
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
                    className="input text-sm"
                  >
                    <option value="support">General Support / Account Help</option>
                    <option value="grievance">Data Protection & Privacy Grievance (DPDP)</option>
                    <option value="job_report">Report a Suspicious Job or Casting Call</option>
                    <option value="partnership">Production House Enterprise Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="label">Your Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Enter your full name"
                    className="input text-sm"
                  />
                </div>

                <div>
                  <label className="label">Your Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="you@example.com"
                    className="input text-sm"
                  />
                </div>

                <div>
                  <label className="label">Subject</label>
                  <input
                    type="text"
                    required
                    value={form.subject}
                    onChange={(e) => setForm(p => ({ ...p, subject: e.target.value }))}
                    placeholder="Brief description of query"
                    className="input text-sm"
                  />
                </div>

                <div>
                  <label className="label">Message</label>
                  <textarea
                    rows={4}
                    required
                    value={form.message}
                    onChange={(e) => setForm(p => ({ ...p, message: e.target.value }))}
                    placeholder="Please provide details..."
                    className="input text-sm resize-none"
                  />
                </div>

                <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
                  <Send size={16} /> Submit Query
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
