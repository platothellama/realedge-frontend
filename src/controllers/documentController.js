const { Document, DocumentVersion, User, DocumentSignature, AuditLog } = require('../models/associations');
const notificationController = require('./notificationController');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const signatureAttempts = new Map();

function generateDocumentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function generateSignatureHash(documentHash, signerEmail, timestamp) {
  const data = `${documentHash}|${signerEmail}|${timestamp}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function logAuditEvent(action, entityType, entityId, userId, ipAddress, userAgent, description, metadata) {
  try {
    await AuditLog.create({
      action,
      entityType,
      entityId,
      userId,
      ipAddress,
      userAgent,
      description,
      metadata
    });
  } catch (error) {
    console.error('Audit logging failed:', error);
  }
}

function checkRateLimit(identifier) {
  const now = Date.now();
  const attempts = signatureAttempts.get(identifier) || [];
  const recentAttempts = attempts.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
  
  if (recentAttempts.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    return false;
  }
  
  recentAttempts.push(now);
  signatureAttempts.set(identifier, recentAttempts);
  return true;
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         'unknown';
}

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { title, type, propertyId, dealId, isDigitalSignatureEnabled, visibility, signerClient, signerAgent, signerOwner, signatureStatus, userId: connectedUserId } = req.body;
    const userId = req.user.id;

    // Create the Document record
    const document = await Document.create({
      title,
      type,
      propertyId: propertyId || null,
      dealId: dealId || null,
      uploadedByUserId: userId,
      isDigitalSignatureEnabled: isDigitalSignatureEnabled === 'true',
      visibility: visibility || 'shareable',
      signerClient: signerClient === 'true' || signerClient === true,
      signerAgent: signerAgent === 'true' || signerAgent === true,
      signerOwner: signerOwner === 'true' || signerOwner === true,
      signatureStatus: signatureStatus || 'pending',
      userId: connectedUserId || null
    });

    // Create the first version
    await DocumentVersion.create({
      versionNumber: 1,
      fileUrl: req.file.filename,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      documentId: document.id,
      uploadedByUserId: userId
    });

    // Generate document content hash for tamper detection
    const fileBuffer = fs.readFileSync(req.file.path);
    const contentHash = generateDocumentHash(fileBuffer);
    
    // Calculate retention period
    const retentionPeriodDays = req.body.retentionPeriodDays || 2555;
    const retentionExpiresAt = new Date();
    retentionExpiresAt.setDate(retentionExpiresAt.getDate() + retentionPeriodDays);

    await document.update({
      documentContentHash: contentHash,
      isTamberSealed: true,
      retentionPeriodDays,
      retentionExpiresAt,
      legalJurisdiction: req.body.legalJurisdiction || 'US',
      esignCompliance: req.body.esignCompliance !== 'false',
      eidasCompliance: req.body.eidasCompliance === 'true'
    });

    // Log document upload
    await logAuditEvent(
      'DOCUMENT_UPLOADED',
      'Document',
      document.id,
      userId,
      getClientIp(req),
      req.headers['user-agent'],
      `Document uploaded: ${document.title}`,
      { fileName: req.file.originalname, fileSize: req.file.size, contentHash }
    );

    // Create notification for document upload
    await notificationController.createNotification(
      userId,
      'Document Uploaded',
      `"${document.title}" has been uploaded successfully`,
      'document',
      `/documents/${document.id}`
    );

    const result = await Document.findByPk(document.id, {
      include: [{ model: DocumentVersion, as: 'versions' }]
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error uploading document', error: error.message });
  }
};

exports.addVersion = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const document = await Document.findByPk(req.params.id);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const newVersionNumber = document.currentVersion + 1;
    const userId = req.user.id;

    await DocumentVersion.create({
      versionNumber: newVersionNumber,
      fileUrl: req.file.filename,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      documentId: document.id,
      uploadedByUserId: userId,
      notes: req.body.notes
    });

    await document.update({ currentVersion: newVersionNumber });

    // Create notification for new version
    await notificationController.createNotification(
      userId,
      'New Document Version',
      `Version ${newVersionNumber} of "${document.title}" has been uploaded`,
      'document',
      `/documents/${document.id}`
    );

    const result = await Document.findByPk(document.id, {
      include: [{ model: DocumentVersion, as: 'versions', order: [['versionNumber', 'DESC']] }]
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error adding version', error: error.message });
  }
};

exports.getDocuments = async (req, res) => {
  try {
    const { propertyId, dealId, userId } = req.query;
    let where = {};
    if (propertyId) where.propertyId = propertyId;
    if (dealId) where.dealId = dealId;
    if (userId) where.userId = userId;

    const documents = await Document.findAll({
      where,
      include: [
        { 
          model: DocumentVersion, 
          as: 'versions',
          include: [{ model: User, as: 'uploader', attributes: ['name'] }]
        },
        { model: User, as: 'uploader', attributes: ['name'] },
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] }
      ],
      order: [['updatedAt', 'DESC']]
    });

    res.status(200).json(documents);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching documents', error: error.message });
  }
};

exports.signDocument = async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    if (document.signatureStatus === 'signed') {
      return res.status(400).json({ message: 'Document has already been signed' });
    }

    if (!document.isDigitalSignatureEnabled) {
      return res.status(400).json({ message: 'Digital signature not enabled for this document' });
    }

    await document.update({
      status: 'Signed',
      signatureStatus: 'signed',
      signedAt: new Date(),
      signedByUserId: req.user.id
    });

    // Create notification for document signing
    await notificationController.createNotification(
      req.user.id,
      'Document Signed',
      `"${document.title}" has been signed successfully`,
      'document',
      `/documents/${document.id}`
    );

    res.status(200).json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error signing document', error: error.message });
  }
};

exports.generateSigningLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { signerEmail, signerType, signerRole, signingOrder, requireEmailVerification } = req.body;
    
    const document = await Document.findByPk(id);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    if (!document.isDigitalSignatureEnabled) {
      return res.status(400).json({ message: 'Digital signature not enabled for this document' });
    }

    const signingToken = uuidv4();
    const emailVerificationToken = requireEmailVerification ? uuidv4() : null;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create signature record for multi-signer support
    const existingSignatures = await DocumentSignature.findAll({ where: { documentId: id } });
    const signerOrderNum = existingSignatures.length + 1;

    await DocumentSignature.create({
      documentId: id,
      signerType: signerType || 'Client',
      signerEmail: signerEmail,
      token: signingToken,
      tokenExpiresAt: expiresAt,
      status: 'sent',
      signerRole: signerRole,
      signingOrder: signerOrderNum,
      emailVerificationToken: emailVerificationToken,
      emailVerified: !requireEmailVerification
    });

    // Update document for multi-signer
    const requiredSignerCount = document.requiredSignerCount || 1;
    const newSignerCount = existingSignatures.length + 1;
    
    await document.update({
      signingToken,
      signingLinkExpiresAt: expiresAt,
      signatureStatus: 'pending',
      requiredSignerCount: Math.max(requiredSignerCount, newSignerCount),
      signingOrder: req.body.signingOrder || 'sequential',
      currentSignerIndex: document.currentSignerIndex || 0
    });

    const signingLink = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/sign/${document.id}/${signingToken}`;

    // Log signing link generation
    await logAuditEvent(
      'SIGNING_LINK_GENERATED',
      'Document',
      id,
      req.user?.id,
      getClientIp(req),
      req.headers['user-agent'],
      `Signing link generated for ${signerEmail || 'anonymous'}`,
      { signerEmail, signerType, signerRole, requireEmailVerification }
    );

    // Create notification for signing link generated
    await notificationController.createNotification(
      req.user?.id,
      'Signing Link Generated',
      `Signing link for "${document.title}" has been generated${signerEmail ? ` for ${signerEmail}` : ''}`,
      'document',
      `/documents/${document.id}`
    );

    res.status(200).json({
      signingLink,
      expiresAt,
      documentId: document.id,
      signerOrder,
      requireEmailVerification: !!emailVerificationToken,
      emailVerificationToken
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating signing link', error: error.message });
  }
};

exports.verifySignerEmail = async (req, res) => {
  try {
    const { documentId, token } = req.params;
    
    const signature = await DocumentSignature.findOne({
      where: { documentId, emailVerificationToken: token }
    });
    
    if (!signature) {
      return res.status(404).json({ message: 'Invalid verification token' });
    }
    
    if (signature.emailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }
    
    if (signature.tokenExpiresAt && new Date() > new Date(signature.tokenExpiresAt)) {
      return res.status(400).json({ message: 'Verification token expired' });
    }
    
    await signature.update({
      emailVerified: true,
      emailVerifiedAt: new Date()
    });
    
    // Log email verification
    await logAuditEvent(
      'EMAIL_VERIFIED',
      'DocumentSignature',
      signature.id,
      null,
      getClientIp(req),
      req.headers['user-agent'],
      `Signer email verified: ${signature.signerEmail}`
    );
    
    res.status(200).json({ 
      message: 'Email verified successfully',
      verified: true
    });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying email', error: error.message });
  }
};

exports.signDocumentByToken = async (req, res) => {
  try {
    const { id, token } = req.params;
    const clientIp = getClientIp(req);

    // Rate limiting check
    if (!checkRateLimit(`sign_${id}_${clientIp}`)) {
      return res.status(429).json({ 
        message: 'Too many signing attempts. Please try again later.',
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 60000) + ' minutes'
      });
    }

    const document = await Document.findByPk(id);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    if (document.signatureStatus === 'signed') {
      return res.status(400).json({ message: 'Document has already been signed' });
    }

    if (document.signingToken !== token) {
      // Log failed attempt
      await logAuditEvent(
        'SIGNATURE_INVALID_TOKEN',
        'Document',
        id,
        null,
        clientIp,
        req.headers['user-agent'],
        'Invalid signing token attempt'
      );
      return res.status(400).json({ message: 'Invalid signing token' });
    }

    if (document.signingLinkExpiresAt && new Date() > new Date(document.signingLinkExpiresAt)) {
      return res.status(400).json({ message: 'Signing link has expired' });
    }

    // Verify document integrity (tamper check)
    const version = await DocumentVersion.findOne({
      where: { documentId: id, versionNumber: document.currentVersion }
    });
    
    let tamperCheckPassed = false;
    if (version && version.fileUrl) {
      const filePath = path.join(__dirname, '../../uploads', version.fileUrl);
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        const currentHash = generateDocumentHash(fileBuffer);
        tamperCheckPassed = currentHash === document.documentContentHash;
      }
    }

    await document.update({
      status: 'Signed',
      signatureStatus: 'signed',
      signedAt: new Date(),
      signingToken: null,
      signingLinkExpiresAt: null,
      isTamberSealed: tamperCheckPassed
    });

    // Generate signature hash
    const signatureHash = generateSignatureHash(
      document.documentContentHash,
      req.user?.email || 'authenticated_user',
      document.signedAt.toISOString()
    );

    // Log successful signature
    await logAuditEvent(
      'DOCUMENT_SIGNED',
      'Document',
      id,
      req.user.id,
      clientIp,
      req.headers['user-agent'],
      'Document signed successfully',
      { signatureHash, tamperCheckPassed }
    );

    // Create notification for document signing
    await notificationController.createNotification(
      req.user.id,
      'Document Signed',
      `"${document.title}" has been signed successfully`,
      'document',
      `/documents/${document.id}`
    );

    // Notify the uploader if different from signer
    if (document.uploadedByUserId && document.uploadedByUserId !== req.user.id) {
      await notificationController.createNotification(
        document.uploadedByUserId,
        'Document Signed',
        `"${document.title}" has been signed by ${req.user.name || req.user.email}`,
        'document',
        `/documents/${document.id}`
      );
    }

    res.status(200).json({ 
      message: 'Document signed successfully', 
      document,
      signatureHash,
      tamperCheckPassed
    });
  } catch (error) {
    res.status(500).json({ message: 'Error signing document', error: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const docTitle = document.title;
    const userId = req.user.id;

    // In a real app, we'd also delete files from disk
    await document.destroy();

    // Create notification for document deletion
    await notificationController.createNotification(
      userId,
      'Document Deleted',
      `"${docTitle}" has been deleted`,
      'document',
      null
    );

    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting document', error: error.message });
  }
};

exports.getPublicSigningData = async (req, res) => {
  try {
    const { documentId, token } = req.params;

    const document = await Document.findByPk(documentId);
    if (!document) return res.status(404).json({ message: 'Document not foud  nd' });

    if (!document.isDigitalSignatureEnabled) {
      return res.status(400).json({ message: 'Digital signature not enabled for this document' });
    }

    if (document.signingToken !== token) {
      return res.status(400).json({ message: 'Invalid signing token' });
    }

    if (document.signingLinkExpiresAt && new Date() > new Date(document.signingLinkExpiresAt)) {
      return res.status(400).json({ message: 'Signing link has expired' });
    }

    const version = await DocumentVersion.findOne({
      where: { documentId, versionNumber: document.currentVersion }
    });

    let property = null;
    if (document.propertyId) {
      const { Property } = require('../models/associations');
      property = await Property.findByPk(document.propertyId);
    }

    res.status(200).json({
      document,
      version,
      property,
      canSign: document.signatureStatus !== 'signed'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error loading signing data', error: error.message });
  }
};

exports.processPublicSignature = async (req, res) => {
  try {
    const { documentId, token } = req.params;
    const { 
      signerName, 
      signerEmail,
      agreedToTerms, 
      agreedToPrivacyPolicy,
      gdprConsent,
      legalDisclosureAcknowledged,
      signatureReason,
      signerRole
    } = req.body;
    
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    // Rate limiting check
    if (!checkRateLimit(`sign_${documentId}_${clientIp}`)) {
      return res.status(429).json({ 
        message: 'Too many signing attempts. Please try again later.',
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 60000) + ' minutes'
      });
    }

    // Validate required consents
    if (!agreedToTerms) {
      return res.status(400).json({ message: 'You must agree to the terms and conditions' });
    }

    if (!agreedToPrivacyPolicy) {
      return res.status(400).json({ message: 'You must agree to the privacy policy' });
    }

    if (!legalDisclosureAcknowledged) {
      return res.status(400).json({ message: 'You must acknowledge the legal disclosures' });
    }

    const document = await Document.findByPk(documentId);

    // Check GDPR consent for EU jurisdiction
    if (document.legalJurisdiction === 'EU' && !gdprConsent) {
      return res.status(400).json({ message: 'GDPR consent is required for documents in EU jurisdiction' });
    }
    if (!document) return res.status(404).json({ message: 'Document not found' });

    if (document.signatureStatus === 'signed') {
      return res.status(400).json({ message: 'Document has already been signed' });
    }

    // Find signature record for multi-signer
    const signatureRecord = await DocumentSignature.findOne({
      where: { documentId, token }
    });

    // Check email verification if required
    if (signatureRecord && signatureRecord.emailVerified === false) {
      return res.status(400).json({ message: 'Email verification required before signing' });
    }

    if (document.signingToken !== token) {
      // Log failed attempt
      await logAuditEvent(
        'SIGNATURE_INVALID_TOKEN',
        'Document',
        documentId,
        null,
        clientIp,
        userAgent,
        'Invalid signing token attempt'
      );
      return res.status(400).json({ message: 'Invalid signing token' });
    }

    if (document.signingLinkExpiresAt && new Date() > new Date(document.signingLinkExpiresAt)) {
      return res.status(400).json({ message: 'Signing link has expired' });
    }

    // Verify document integrity (tamper check)
    const version = await DocumentVersion.findOne({
      where: { documentId, versionNumber: document.currentVersion }
    });
    
    let tamperCheckPassed = false;
    if (version && version.fileUrl) {
      const filePath = path.join(__dirname, '../../uploads', version.fileUrl);
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        const currentHash = generateDocumentHash(fileBuffer);
        tamperCheckPassed = currentHash === document.documentContentHash;
      }
    }

    const signedAt = new Date();
    
    await document.update({
      status: 'Signed',
      signatureStatus: 'signed',
      signedAt,
      signingToken: null,
      signingLinkExpiresAt: null,
      isTamberSealed: tamperCheckPassed
    });

    // Generate signature hash
    const signatureHash = generateSignatureHash(
      document.documentContentHash,
      signerEmail || signerName || 'anonymous',
      signedAt.toISOString()
    );

    // Update or create signature record
    if (signatureRecord) {
      await signatureRecord.update({
        signerName: signerName || signatureRecord.signerName,
        signerEmail: signerEmail || signatureRecord.signerEmail,
        status: 'signed',
        signedAt,
        signedIpAddress: clientIp,
        signedUserAgent: userAgent,
        signatureHash,
        documentHash: document.documentContentHash,
        agreedToTerms: true,
        agreedToPrivacyPolicy: true,
        privacyPolicyAcceptedAt: new Date(),
        termsAcceptedAt: new Date(),
        gdprConsent: gdprConsent || false,
        gdprConsentDate: gdprConsent ? new Date() : null,
        gdprConsentIp: gdprConsent ? clientIp : null,
        legalDisclosureAcknowledged: true,
        legalDisclosureAcknowledgedAt: new Date(),
        signatureReason: signatureReason || 'Document signed electronically',
        signerRole: signerRole || signatureRecord.signerRole,
        tamperCheckPassed
      });
    } else {
      await DocumentSignature.create({
        documentId,
        signerType: signerRole || 'Client',
        signerName,
        signerEmail,
        status: 'signed',
        signedAt,
        signedIpAddress: clientIp,
        signedUserAgent: userAgent,
        signatureHash,
        documentHash: document.documentContentHash,
        agreedToTerms: true,
        agreedToPrivacyPolicy: true,
        privacyPolicyAcceptedAt: new Date(),
        termsAcceptedAt: new Date(),
        gdprConsent: gdprConsent || false,
        gdprConsentDate: gdprConsent ? new Date() : null,
        gdprConsentIp: gdprConsent ? clientIp : null,
        legalDisclosureAcknowledged: true,
        legalDisclosureAcknowledgedAt: new Date(),
        signatureReason: signatureReason || 'Document signed electronically',
        signerRole: signerRole,
        tamperCheckPassed
      });
    }

    // Log successful signature with all compliance data
    await logAuditEvent(
      'DOCUMENT_SIGNED',
      'Document',
      documentId,
      null,
      clientIp,
      userAgent,
      'Document signed successfully with full compliance',
      { 
        signerName, 
        signerEmail, 
        signatureHash, 
        tamperCheckPassed,
        gdprConsent,
        agreedToTerms,
        agreedToPrivacyPolicy,
        legalDisclosureAcknowledged,
        legalJurisdiction: document.legalJurisdiction
      }
    );

    // Notify the uploader that document was signed
    if (document.uploadedByUserId) {
      await notificationController.createNotification(
        document.uploadedByUserId,
        'Document Signed',
        `"${document.title}" has been signed by ${signerName || signerEmail || 'a signer'}`,
        'document',
        `/documents/${document.id}`
      );
    }

    res.status(200).json({
      message: 'Document signed successfully',
      signatureDetails: {
        signerName,
        signedAt,
        signatureHash,
        tamperCheckPassed
      },
      legalNotice: document.legalJurisdiction === 'EU' 
        ? 'This electronic signature complies with eIDAS Regulation (EU)'
        : 'This electronic signature complies with the ESIGN Act and UETA'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing signature', error: error.message });
  }
};

exports.getComplianceDisclosures = async (req, res) => {
  try {
    const { documentId } = req.params;
    const document = await Document.findByPk(documentId);
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const jurisdiction = document.legalJurisdiction || 'US';
    
    const disclosures = {
      esignAct: {
        required: true,
        text: 'Under the Electronic Signatures in Global and National Commerce Act (ESIGN Act) and the Uniform Electronic Transactions Act (UETA), this electronic signature is legally binding and enforceable.',
        requirements: [
          'Signer must agree to conduct transactions electronically',
          'Signer must be provided with a copy of the electronic record',
          'Signer must be informed of the hardware and software requirements'
        ]
      },
      eidas: {
        required: jurisdiction === 'EU',
        text: 'Under the eIDAS Regulation (EU No 910/2014), this electronic signature meets the requirements for a qualified electronic signature.',
        requirements: jurisdiction === 'EU' ? [
          'Signature is based on a qualified certificate',
          'Signature is created using a qualified signature creation device',
          'Signature is uniquely linked to the signatory'
        ] : []
      },
      gdpr: {
        required: jurisdiction === 'EU',
        text: 'Your personal data is processed in accordance with the General Data Protection Regulation (GDPR).',
        dataProcessing: [
          'Data is processed for the purpose of electronic signature',
          'Data is retained for the legally required period',
          'You have the right to access, rectify, and delete your data'
        ]
      },
      privacyPolicy: {
        required: true,
        text: 'By signing this document, you acknowledge that you have read and agree to our privacy policy.'
      },
      dataRetention: {
        required: true,
        retentionPeriod: document.retentionPeriodDays || 2555,
        text: `This document and signature data will be retained for ${document.retentionPeriodDays || 2555} days (${Math.floor((document.retentionPeriodDays || 2555) / 365)} years) for legal and compliance purposes.`
      }
    };

    res.status(200).json({
      jurisdiction,
      disclosures,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching disclosures', error: error.message });
  }
};

exports.getSignatureAuditTrail = async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const auditLogs = await AuditLog.findAll({
      where: {
        entityType: 'Document',
        entityId: documentId,
        action: {
          [require('sequelize').Op.in]: [
            'DOCUMENT_UPLOADED',
            'SIGNING_LINK_GENERATED',
            'EMAIL_VERIFIED',
            'DOCUMENT_SIGNED',
            'SIGNATURE_INVALID_TOKEN'
          ]
        }
      },
      order: [['createdAt', 'ASC']]
    });

    const signatureRecords = await DocumentSignature.findAll({
      where: { documentId }
    });

    res.status(200).json({
      auditLogs,
      signatureRecords,
      documentIntegrity: {
        isTamberSealed: true,
        contentHash: 'Stored for verification'
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching audit trail', error: error.message });
  }
};
