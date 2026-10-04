/**
 * CineConnect Email Templates
 * Brand Colors:
 * - Primary Navy: #0B2545
 * - Accent Gold:  #E0A96D
 *
 * Provides responsive HTML and clean plain-text alternatives for all system emails.
 * Every email contains a token-based one-click unsubscribe link (no login needed).
 */

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

export type SupportedTemplate =
  | 'new_application'
  | 'status_change'
  | 'new_message'
  | 'job_closed'
  | 'talent_alert_match'
  | 'digest'

const BRAND_NAVY = '#0B2545'
const BRAND_GOLD = '#E0A96D'
const BG_COLOR   = '#F4F6F9'
const CARD_BG    = '#FFFFFF'
const TEXT_MAIN  = '#1E293B'
const TEXT_MUTED = '#64748B'

function getAppUrl(explicitUrl?: string): string {
  return explicitUrl || process.env.APP_URL || 'http://localhost:5173'
}

/**
 * Wraps content in the branded CineConnect master layout.
 */
function wrapHtmlLayout(title: string, bodyContent: string, unsubToken: string, appUrl: string): string {
  const settingsUrl = `${appUrl}/settings?tab=notifications`
  const unsubUrl = `${appUrl}/unsubscribe/${unsubToken}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BG_COLOR}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${TEXT_MAIN}; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${BG_COLOR}; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: ${CARD_BG}; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 14px rgba(11, 37, 69, 0.08); border-top: 4px solid ${BRAND_GOLD};">
          <!-- Header -->
          <tr>
            <td style="background-color: ${BRAND_NAVY}; padding: 24px 32px; text-align: left;">
              <span style="font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">Cine<span style="color: ${BRAND_GOLD};">Connect</span></span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px; font-size: 15px; line-height: 1.6; color: ${TEXT_MAIN};">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; padding: 20px 32px; text-align: center; border-top: 1px solid #E2E8F0; font-size: 12px; color: ${TEXT_MUTED}; line-height: 1.5;">
              <p style="margin: 0 0 8px 0;">
                You are receiving this notification according to your CineConnect preferences.
              </p>
              <p style="margin: 0;">
                <a href="${settingsUrl}" style="color: ${BRAND_NAVY}; font-weight: 600; text-decoration: underline;">Notification Settings</a>
                &nbsp;•&nbsp;
                <a href="${unsubUrl}" style="color: ${BRAND_NAVY}; font-weight: 600; text-decoration: underline;">Instant Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Creates an attractive button CTA for HTML emails.
 */
function renderButton(text: string, href: string): string {
  return `
    <div style="margin: 28px 0 16px 0; text-align: center;">
      <a href="${href}" style="background-color: ${BRAND_NAVY}; color: #FFFFFF; padding: 12px 26px; border-radius: 6px; font-weight: 600; font-size: 14px; text-decoration: none; display: inline-block; box-shadow: 0 2px 6px rgba(11, 37, 69, 0.2); border-left: 3px solid ${BRAND_GOLD};">
        ${text} &rarr;
      </a>
    </div>`
}

/**
 * Renders any of the 6 core templates based on templateName and payload.
 */
export function renderEmailTemplate(
  templateName: SupportedTemplate | string,
  payload: Record<string, any>,
  unsubToken: string,
  customAppUrl?: string
): RenderedEmail {
  const appUrl = getAppUrl(customAppUrl)
  const settingsUrl = `${appUrl}/settings?tab=notifications`
  const unsubUrl = `${appUrl}/unsubscribe/${unsubToken}`

  switch (templateName) {
    case 'new_application': {
      const applicantName = payload.applicant_name || 'A candidate'
      const jobTitle = payload.job_title || 'your posting'
      const coverNote = payload.cover_note ? `<blockquote>"${payload.cover_note}"</blockquote>` : ''
      const plainNote = payload.cover_note ? `\n\nCover Note:\n"${payload.cover_note}"` : ''
      const actionUrl = payload.application_id
        ? `${appUrl}/applications`
        : `${appUrl}/dashboard`

      const subject = `New Application: ${applicantName} applied for ${jobTitle}`
      const htmlBody = `
        <h2 style="color: ${BRAND_NAVY}; margin-top: 0; font-size: 20px;">New Application Received</h2>
        <p><strong>${applicantName}</strong> has submitted an application for <strong>${jobTitle}</strong>.</p>
        ${coverNote ? `<div style="background: #F1F5F9; border-left: 4px solid ${BRAND_GOLD}; padding: 12px 16px; margin: 16px 0; font-style: italic; color: #334155;">"${payload.cover_note}"</div>` : ''}
        <p>Review candidate credits, portfolio, and verify availability on CineConnect:</p>
        ${renderButton('Review Application', actionUrl)}
      `
      const text = `New Application Received\n\n${applicantName} has applied for ${jobTitle}.${plainNote}\n\nReview the application: ${actionUrl}\n\nNotification settings: ${settingsUrl}\nUnsubscribe: ${unsubUrl}`

      return {
        subject,
        html: wrapHtmlLayout(subject, htmlBody, unsubToken, appUrl),
        text,
      }
    }

    case 'status_change': {
      const jobTitle = payload.job_title || 'Your Application'
      const status = payload.status || 'updated'
      const companyName = payload.company_name || 'Production'
      const interviewAt = payload.interview_at
        ? new Date(payload.interview_at).toLocaleString('en-US', {
            dateStyle: 'full',
            timeStyle: 'short',
          })
        : null

      const subject = `Application Update: ${jobTitle} (${status.toUpperCase()})`

      let interviewSectionHtml = ''
      let interviewSectionText = ''
      if (interviewAt) {
        interviewSectionHtml = `
          <div style="background-color: #FEF3C7; border: 1px solid #FCD34D; border-left: 4px solid ${BRAND_GOLD}; padding: 14px 18px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0 0 6px 0; font-weight: 700; color: #92400E; font-size: 14px;">📅 Interview Scheduled</p>
            <p style="margin: 0; font-size: 15px; font-weight: 600; color: ${BRAND_NAVY};">${interviewAt}</p>
          </div>
        `
        interviewSectionText = `\n\nInterview Date & Time: ${interviewAt}\n`
      }

      const actionUrl = `${appUrl}/applications`
      const htmlBody = `
        <h2 style="color: ${BRAND_NAVY}; margin-top: 0; font-size: 20px;">Application Status Update</h2>
        <p>Your application for <strong>${jobTitle}</strong> with <strong>${companyName}</strong> has been updated to:</p>
        <div style="text-align: center; margin: 18px 0;">
          <span style="background-color: ${BRAND_NAVY}; color: ${BRAND_GOLD}; font-weight: 700; font-size: 15px; padding: 6px 16px; border-radius: 20px; letter-spacing: 0.5px; text-transform: uppercase;">
            ${status}
          </span>
        </div>
        ${interviewSectionHtml}
        <p>Visit your CineConnect dashboard to view details or communicate with the team.</p>
        ${renderButton('View Application Details', actionUrl)}
      `
      const text = `Application Status Update\n\nYour application for ${jobTitle} with ${companyName} has moved to: ${status.toUpperCase()}.${interviewSectionText}\n\nView details: ${actionUrl}\n\nNotification settings: ${settingsUrl}\nUnsubscribe: ${unsubUrl}`

      return {
        subject,
        html: wrapHtmlLayout(subject, htmlBody, unsubToken, appUrl),
        text,
      }
    }

    case 'new_message': {
      const senderName = payload.sender_name || 'A contact'
      const preview = payload.message_preview
        ? `"${payload.message_preview.slice(0, 160)}${payload.message_preview.length > 160 ? '...' : ''}"`
        : 'You have received a new message.'
      const actionUrl = `${appUrl}/chat`

      const subject = `New message from ${senderName} on CineConnect`
      const htmlBody = `
        <h2 style="color: ${BRAND_NAVY}; margin-top: 0; font-size: 20px;">New Direct Message</h2>
        <p><strong>${senderName}</strong> sent you a message:</p>
        <div style="background-color: #F8FAFC; border-left: 4px solid ${BRAND_GOLD}; padding: 14px 18px; border-radius: 4px; margin: 18px 0; color: #334155; font-style: italic;">
          ${preview}
        </div>
        <p>Keep your conversations within CineConnect to safeguard contacts and production agreements.</p>
        ${renderButton('Reply to Message', actionUrl)}
      `
      const text = `New Direct Message from ${senderName}\n\n${preview}\n\nReply in chat: ${actionUrl}\n\nNotification settings: ${settingsUrl}\nUnsubscribe: ${unsubUrl}`

      return {
        subject,
        html: wrapHtmlLayout(subject, htmlBody, unsubToken, appUrl),
        text,
      }
    }

    case 'job_closed': {
      const jobTitle = payload.job_title || 'A job you applied for'
      const companyName = payload.company_name || 'The production company'
      const actionUrl = `${appUrl}/search`

      const subject = `Notice: ${jobTitle} has been closed`
      const htmlBody = `
        <h2 style="color: ${BRAND_NAVY}; margin-top: 0; font-size: 20px;">Job Closed Notice</h2>
        <p>The posting for <strong>${jobTitle}</strong> by <strong>${companyName}</strong> has been marked as closed.</p>
        <p>Applications are no longer being accepted for this role. We encourage you to explore open listings matching your department and skills.</p>
        ${renderButton('Explore Open Opportunities', actionUrl)}
      `
      const text = `Job Closed: ${jobTitle}\n\nThe listing for ${jobTitle} by ${companyName} has been closed.\n\nExplore other roles: ${actionUrl}\n\nNotification settings: ${settingsUrl}\nUnsubscribe: ${unsubUrl}`

      return {
        subject,
        html: wrapHtmlLayout(subject, htmlBody, unsubToken, appUrl),
        text,
      }
    }

    case 'talent_alert_match': {
      const jobTitle = payload.job_title || 'New Job Opportunity'
      const companyName = payload.company_name || 'A verified studio'
      const location = payload.location ? `in ${payload.location}` : ''
      const jobId = payload.job_id || ''
      const actionUrl = jobId ? `${appUrl}/jobs/${jobId}` : `${appUrl}/search`

      const subject = `Talent Alert: New opening for ${jobTitle}`
      const htmlBody = `
        <h2 style="color: ${BRAND_NAVY}; margin-top: 0; font-size: 20px;">Matching Role Detected</h2>
        <p>A new role matching your saved alert criteria was just published:</p>
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px; margin: 18px 0;">
          <h3 style="margin: 0 0 6px 0; color: ${BRAND_NAVY}; font-size: 17px;">${jobTitle}</h3>
          <p style="margin: 0; color: ${TEXT_MUTED}; font-size: 14px;">${companyName} ${location}</p>
        </div>
        <p>Early applicants often get prioritized by department heads and casting teams.</p>
        ${renderButton('View Job & Apply', actionUrl)}
      `
      const text = `Talent Alert Match: ${jobTitle}\n\nPublished by ${companyName} ${location}.\n\nView and apply: ${actionUrl}\n\nNotification settings: ${settingsUrl}\nUnsubscribe: ${unsubUrl}`

      return {
        subject,
        html: wrapHtmlLayout(subject, htmlBody, unsubToken, appUrl),
        text,
      }
    }

    case 'digest': {
      const frequency = payload.frequency === 'weekly' ? 'Weekly' : 'Daily'
      const appCount = payload.new_applications_count ?? 0
      const msgCount = payload.unread_messages_count ?? 0
      const oppCount = payload.matching_jobs_count ?? 0
      const actionUrl = `${appUrl}/dashboard`

      const subject = `Your CineConnect ${frequency} Digest`
      const htmlBody = `
        <h2 style="color: ${BRAND_NAVY}; margin-top: 0; font-size: 20px;">Your ${frequency} Summary</h2>
        <p>Here is your activity overview on CineConnect:</p>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0;">
          <tr>
            <td style="padding: 12px; background: #F8FAFC; border-radius: 6px; border: 1px solid #E2E8F0; text-align: center; width: 33%;">
              <div style="font-size: 22px; font-weight: 700; color: ${BRAND_NAVY};">${appCount}</div>
              <div style="font-size: 12px; color: ${TEXT_MUTED}; text-transform: uppercase; margin-top: 4px;">Applications</div>
            </td>
            <td style="width: 10px;"></td>
            <td style="padding: 12px; background: #F8FAFC; border-radius: 6px; border: 1px solid #E2E8F0; text-align: center; width: 33%;">
              <div style="font-size: 22px; font-weight: 700; color: ${BRAND_NAVY};">${msgCount}</div>
              <div style="font-size: 12px; color: ${TEXT_MUTED}; text-transform: uppercase; margin-top: 4px;">Messages</div>
            </td>
            <td style="width: 10px;"></td>
            <td style="padding: 12px; background: #F8FAFC; border-radius: 6px; border: 1px solid #E2E8F0; text-align: center; width: 33%;">
              <div style="font-size: 22px; font-weight: 700; color: ${BRAND_NAVY};">${oppCount}</div>
              <div style="font-size: 12px; color: ${TEXT_MUTED}; text-transform: uppercase; margin-top: 4px;">Opportunities</div>
            </td>
          </tr>
        </table>
        <p>Log in to view all activities and continue your projects.</p>
        ${renderButton('Go to Dashboard', actionUrl)}
      `
      const text = `Your CineConnect ${frequency} Digest\n\n- Applications: ${appCount}\n- Messages: ${msgCount}\n- Opportunities: ${oppCount}\n\nGo to dashboard: ${actionUrl}\n\nNotification settings: ${settingsUrl}\nUnsubscribe: ${unsubUrl}`

      return {
        subject,
        html: wrapHtmlLayout(subject, htmlBody, unsubToken, appUrl),
        text,
      }
    }

    default: {
      const subject = payload.subject || 'CineConnect Notification'
      const message = payload.message || 'You have a new notification on CineConnect.'
      const actionUrl = `${appUrl}/dashboard`
      const htmlBody = `
        <h2 style="color: ${BRAND_NAVY}; margin-top: 0; font-size: 20px;">Notification</h2>
        <p>${message}</p>
        ${renderButton('Open CineConnect', actionUrl)}
      `
      const text = `Notification: ${message}\n\nOpen CineConnect: ${actionUrl}\n\nNotification settings: ${settingsUrl}\nUnsubscribe: ${unsubUrl}`

      return {
        subject,
        html: wrapHtmlLayout(subject, htmlBody, unsubToken, appUrl),
        text,
      }
    }
  }
}
