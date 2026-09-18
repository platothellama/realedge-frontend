const sgMail = require('@sendgrid/mail');
const { EmailTracking } = require('../models/associations');

class EmailService {
  constructor() {
    this.isConfigured = false;
    this.initialize();
  }

  initialize() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.isConfigured = true;
      console.log('✅ SendGrid email service configured');
    } else {
      console.log('⚠️  SENDGRID_API_KEY not set - emails will be simulated');
    }
  }

  async sendEmail({ to, subject, body, campaignId, leadId, agentId }) {
    // QA hardening 2026-09-18: validate the recipient (previously any
    // array/object flowed into SendGrid + the tracking table).
    if (typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
      return { success: false, error: 'Invalid recipient email' };
    }

    const trackingId = this.generateTrackingId();
    
    const emailWithTracking = this.injectTrackingPixels(body, trackingId);
    const emailWithLinks = this.wrapLinksWithTracking(emailWithTracking, trackingId);

    const emailTrackingData = {
      id: trackingId,
      leadId,
      campaignId,
      agentId,
      subject,
      body: emailWithLinks,
      recipientEmail: to,
      status: 'sent',
      sentAt: new Date()
    };

    if (!this.isConfigured) {
      console.log(`📧 [SIMULATED] Sending email to ${to}: ${subject}`);
      
      await EmailTracking.create(emailTrackingData);
      
      return {
        success: true,
        messageId: trackingId,
        simulated: true
      };
    }

    try {
      const msg = {
        to,
        from: process.env.EMAIL_FROM || 'noreply@realestate.com',
        subject,
        html: emailWithLinks,
        trackingSettings: {
          clickTracking: { enable: false },
          openTracking: { enable: false }
        }
      };

      await sgMail.send(msg);
      
      await EmailTracking.create(emailTrackingData);

      return {
        success: true,
        messageId: trackingId
      };
    } catch (error) {
      console.error('SendGrid error:', error.message);
      
      await EmailTracking.create({
        ...emailTrackingData,
        status: 'failed'
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendBulkEmails(emails) {
    // QA hardening 2026-09-18: bounded, chunked fan-out (was one unbounded
    // Promise.allSettled over the whole list).
    const list = Array.isArray(emails) ? emails.slice(0, 500) : [];
    const all = [];
    for (let i = 0; i < list.length; i += 25) {
      const chunk = await Promise.allSettled(
        list.slice(i, i + 25).map((email) => this.sendEmail(email))
      );
      all.push(...chunk);
    }

    return {
      total: all.length,
      successful: all.filter(r => r.status === 'fulfilled' && r.value.success).length,
      failed: all.filter(r => r.status === 'rejected' || !r.value.success).length,
      results: all
    };
  }

  injectTrackingPixels(html, trackingId) {
    const trackingUrl = `${process.env.API_URL || 'https://realedge-frontend.onrender.com'}/api/track/open/${trackingId}`;
    const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none" alt="" />`;

    // QA hardening 2026-09-18: undefined body used to render "undefined<img…".
    return `${html ?? ''}${trackingPixel}`;
  }

  wrapLinksWithTracking(html, trackingId) {
    const baseUrl = process.env.API_URL || 'https://realedge-frontend.onrender.com';
    // QA hardening 2026-09-18: encode the target (raw $1 broke URLs with &).
    return `${html ?? ''}`.replace(
      /href=["'](https?:\/\/[^"']+)["']/g,
      (m, url) => `href="${baseUrl}/api/track/click/${trackingId}?url=${encodeURIComponent(url)}"`
    );
  }

  generateTrackingId() {
    // QA hardening 2026-09-18: 122-bit entropy (was ~48-bit Math.random,
    // enumerable against the public pixel endpoints).
    return 'em_' + require('crypto').randomUUID().replace(/-/g, '');
  }

  async handleOpenTracking(trackingId) {
    try {
      const email = await EmailTracking.findByPk(trackingId);
      if (email && !email.openedAt) {
        await email.update({
          status: 'opened',
          openedAt: new Date(),
          openCount: email.openCount + 1
        });
      }
    } catch (error) {
      console.error('Open tracking error:', error.message);
    }
    return '<html><body></body></html>';
  }

  async handleClickTracking(trackingId, originalUrl) {
    try {
      const email = await EmailTracking.findByPk(trackingId);
      if (email) {
        await email.update({
          status: 'clicked',
          clickedAt: new Date(),
          clickCount: email.clickCount + 1
        });
      }
    } catch (error) {
      console.error('Click tracking error:', error.message);
    }
    return originalUrl;
  }
}

module.exports = new EmailService();
