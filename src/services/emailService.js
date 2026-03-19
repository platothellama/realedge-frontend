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
    const results = await Promise.allSettled(
      emails.map(email => this.sendEmail(email))
    );
    
    return {
      total: emails.length,
      successful: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
      failed: results.filter(r => r.status === 'rejected' || !r.value.success).length,
      results
    };
  }

  injectTrackingPixels(html, trackingId) {
    const trackingUrl = `${process.env.API_URL || 'https://realedge-frontend-production.up.railway.app/'}/api/track/open/${trackingId}`;
    const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none" alt="" />`;
    
    return html + trackingPixel;
  }

  wrapLinksWithTracking(html, trackingId) {
    const baseUrl = process.env.API_URL || 'https://realedge-frontend-production.up.railway.app/';
    const wrappedHtml = html.replace(
      /href=["'](https?:\/\/[^"']+)["']/g,
      `href="${baseUrl}/api/track/click/${trackingId}?url=$1"`
    );
    return wrappedHtml;
  }

  generateTrackingId() {
    return 'em_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
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
