/**
 * Thin EmailProvider interface & Resend implementation
 * Supports swappable providers and deterministic mocking for tests.
 */

export interface EmailMessage {
  to: string | string[]
  from?: string
  subject: string
  html: string
  text: string
  replyTo?: string
  headers?: Record<string, string>
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface EmailProvider {
  readonly name: string
  send(message: EmailMessage): Promise<SendEmailResult>
}

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend'
  private apiKey: string
  private defaultFrom: string

  constructor(apiKey?: string, defaultFrom?: string) {
    this.apiKey = apiKey || process.env.RESEND_API_KEY || ''
    this.defaultFrom = defaultFrom || process.env.EMAIL_FROM || 'CineConnect <noreply@cineconnect.app>'
  }

  async send(message: EmailMessage): Promise<SendEmailResult> {
    if (!this.apiKey) {
      return { success: false, error: 'RESEND_API_KEY is not configured' }
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: message.from || this.defaultFrom,
          to: Array.isArray(message.to) ? message.to : [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo,
          headers: message.headers,
        }),
      })

      const data = (await response.json().catch(() => ({}))) as any

      if (!response.ok) {
        const errorMsg = data?.message || `Resend API error (${response.status})`
        return { success: false, error: errorMsg }
      }

      return { success: true, messageId: data?.id }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error communicating with Resend' }
    }
  }
}

export class MockEmailProvider implements EmailProvider {
  readonly name = 'mock'
  public sentEmails: EmailMessage[] = []
  public failNext = false
  public failError = 'Simulated email provider failure'

  async send(message: EmailMessage): Promise<SendEmailResult> {
    if (this.failNext) {
      this.failNext = false
      return { success: false, error: this.failError }
    }
    this.sentEmails.push({ ...message })
    return {
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    }
  }

  clear(): void {
    this.sentEmails = []
    this.failNext = false
  }
}

// Global active provider instance (defaults to Resend in runtime, replaceable in tests)
let activeProvider: EmailProvider = new ResendEmailProvider()

export function getEmailProvider(): EmailProvider {
  return activeProvider
}

export function setEmailProvider(provider: EmailProvider): void {
  activeProvider = provider
}
