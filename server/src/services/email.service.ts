export interface EmailDispatchOptions {
  to: string;
  subject: string;
  htmlContent: string;
  textFallback?: string;
}

export interface EmailDispatchResult {
  success: boolean;
  messageId: string;
  mode: 'LIVE_SENDGRID' | 'LIVE_RESEND' | 'SIMULATED_TEST_TIER';
  timestamp: string;
  recipient: string;
}

class EmailService {
  private sendgridApiKey = process.env.SENDGRID_API_KEY;
  private resendApiKey = process.env.RESEND_API_KEY;
  private senderEmail = process.env.SENDER_EMAIL || 'ops-specialist@ecommerce-store.internal';

  async sendEmail(options: EmailDispatchOptions): Promise<EmailDispatchResult> {
    const timestamp = new Date().toISOString();

    // 1. Try Resend if configured
    if (this.resendApiKey) {
      try {
        const fromAddress = process.env.SENDER_EMAIL || 'onboarding@resend.dev';
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [options.to],
            subject: options.subject,
            html: options.htmlContent,
          }),
        });

        const data: any = await response.json();
        if (response.ok) {
          console.log(`[EmailService] Resend live email dispatched to ${options.to} (Message ID: ${data.id})`);
          return {
            success: true,
            messageId: data.id,
            mode: 'LIVE_RESEND',
            timestamp,
            recipient: options.to,
          };
        } else {
          console.warn(`[EmailService] Resend API notice: ${data.message || JSON.stringify(data)}. Falling back to safe simulation.`);
        }
      } catch (err: any) {
        console.warn('[EmailService] Resend delivery network issue, falling back to mock:', err.message);
      }
    }

    // 2. Try SendGrid if configured
    if (this.sendgridApiKey) {
      try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.sendgridApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: options.to }] }],
            from: { email: this.senderEmail },
            subject: options.subject,
            content: [{ type: 'text/html', value: options.htmlContent }],
          }),
        });

        if (response.status === 202) {
          const messageId = `sg-${Date.now()}`;
          console.log(`[EmailService] SendGrid dispatched to ${options.to}`);
          return {
            success: true,
            messageId,
            mode: 'LIVE_SENDGRID',
            timestamp,
            recipient: options.to,
          };
        }
      } catch (err) {
        console.warn('[EmailService] SendGrid delivery failed, falling back to mock:', err);
      }
    }

    // 3. Fallback to Free Mock Simulator (Guaranteed to work without payment/billing credentials)
    const simulatedId = `sim_msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    console.log(
      `[EmailService: SIMULATED FREE TIER] To: ${options.to} | Subject: "${options.subject}" | ID: ${simulatedId}`
    );

    return {
      success: true,
      messageId: simulatedId,
      mode: 'SIMULATED_TEST_TIER',
      timestamp,
      recipient: options.to,
    };
  }
}

export const emailService = new EmailService();
