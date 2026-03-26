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

  async sendSignatureRequest({ to, signerName, documentTitle, signerType, signUrl, propertyTitle, expiresIn }) {
    const subject = `Action Required: Please Sign "${documentTitle}"`;
    
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Digital Signature Request</h1>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px;">
          <p style="font-size: 16px; color: #334155;">Hello ${signerName || 'there'},</p>
          
          <p style="font-size: 16px; color: #334155;">
            You have been requested to sign the following document as <strong>${signerType}</strong>:
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #6366f1;">
            <h3 style="margin: 0 0 10px; color: #1e293b;">${documentTitle}</h3>
            ${propertyTitle ? `<p style="margin: 0; color: #64748b; font-size: 14px;">Property: ${propertyTitle}</p>` : ''}
          </div>
          
          <p style="font-size: 14px; color: #64748b;">
            This link will expire in <strong>${expiresIn}</strong>.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${signUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Sign Document
            </a>
          </div>
          
          <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; margin-top: 30px;">
            <h4 style="margin: 0 0 10px; color: #475569;">Important Legal Notice</h4>
            <ul style="margin: 0; padding-left: 20px; color: #64748b; font-size: 13px; line-height: 1.8;">
              <li>Your electronic signature is legally binding</li>
              <li>Your IP address and timestamp will be recorded</li>
              <li>Do not share this link with others</li>
            </ul>
          </div>
          
          <p style="font-size: 12px; color: #94a3b8; margin-top: 30px; text-align: center;">
            If you did not expect this email, please ignore it or contact support.
          </p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to,
      subject,
      body
    });
  }

  async sendSignatureCompleted({ to, documentTitle, signerType, allSigned, propertyTitle }) {
    const subject = allSigned 
      ? `All Signatures Complete: "${documentTitle}"`
      : `Document Signed: "${documentTitle}"`;
    
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${allSigned ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)'}; padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${allSigned ? 'All Signatures Complete!' : 'Document Signed'}</h1>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px;">
          <p style="font-size: 16px; color: #334155;">
            The document has been signed by <strong>${signerType}</strong>.
            ${allSigned ? ' All required signatures have been collected.' : ' Waiting for other signatures.'}
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid ${allSigned ? '#10b981' : '#6366f1'};">
            <h3 style="margin: 0 0 10px; color: #1e293b;">${documentTitle}</h3>
            ${propertyTitle ? `<p style="margin: 0; color: #64748b; font-size: 14px;">Property: ${propertyTitle}</p>` : ''}
          </div>
          
          ${allSigned ? `
          <div style="background: rgba(16, 185, 129, 0.1); padding: 20px; border-radius: 12px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px; color: #10b981;">Document Status: Fully Signed</h4>
            <p style="margin: 0; color: #64748b; font-size: 14px;">
              This document is now legally binding. You can view and download the signed certificate from your documents.
            </p>
          </div>
          ` : ''}
          
          <p style="font-size: 12px; color: #94a3b8; margin-top: 30px; text-align: center;">
            This is an automated notification from your Real Estate Management System.
          </p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to,
      subject,
      body
    });
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
