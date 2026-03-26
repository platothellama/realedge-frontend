const { Document, DocumentVersion, User, Seller, Team, Property, DocumentSignature, Notification } = require('../models/associations');
const { Op } = require('sequelize');
const crypto = require('crypto');
const emailService = require('../services/emailService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4200';

const generateSignatureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const generateDocumentHash = (document, version) => {
  const data = `${document.id}-v${version.versionNumber}-${version.fileName}-${version.fileSize}-${document.title}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const { 
      type, 
      propertyId, 
      dealId, 
      sellerId, 
      teamUserId, 
      visibility,
      isDigitalSignatureEnabled,
      signers,
      notes
    } = req.body;
    
    const userId = req.user.id;
    const documents = [];

    const signersArray = signers ? JSON.parse(signers) : [];

    for (const file of req.files) {
      const fileTitle = file.originalname.split('.').slice(0, -1).join('.');

      const document = await Document.create({
        title: fileTitle,
        type: type || 'Other',
        propertyId: propertyId || null,
        dealId: dealId || null,
        sellerId: sellerId || null,
        teamUserId: teamUserId || null,
        uploadedByUserId: userId,
        visibility: visibility || 'internal',
        isDigitalSignatureEnabled: isDigitalSignatureEnabled === 'true',
        signers: signersArray,
        notes: notes || null,
        status: signersArray.length > 0 ? 'Pending Signature' : 'Draft'
      });

      const version = await DocumentVersion.create({
        versionNumber: 1,
        fileUrl: file.filename,
        fileName: file.originalname,
        fileSize: file.size,
        documentId: document.id,
        uploadedByUserId: userId
      });

      if (isDigitalSignatureEnabled === 'true' && signersArray.length > 0) {
        for (const signer of signersArray) {
          await DocumentSignature.create({
            documentId: document.id,
            signerType: signer.type,
            signerName: signer.name || null,
            signerEmail: signer.email || null,
            status: 'pending'
          });
        }
      }

      documents.push(document);
    }

    if (documents.length === 1) {
      const result = await Document.findByPk(documents[0].id, {
        include: [
          { model: DocumentVersion, as: 'versions' },
          { model: User, as: 'uploader', attributes: ['id', 'name', 'email'] },
          { model: Seller, as: 'seller', attributes: ['id', 'name'] },
          { model: Team, as: 'team', attributes: ['id', 'name'] },
          { model: Property, as: 'property', attributes: ['id', 'title'] },
          { model: DocumentSignature, as: 'signatures' }
        ]
      });
      res.status(201).json(result);
    } else {
      const results = await Document.findAll({
        where: { id: documents.map(d => d.id) },
        include: [
          { model: DocumentVersion, as: 'versions' },
          { model: User, as: 'uploader', attributes: ['id', 'name', 'email'] },
          { model: Seller, as: 'seller', attributes: ['id', 'name'] },
          { model: Team, as: 'team', attributes: ['id', 'name'] },
          { model: Property, as: 'property', attributes: ['id', 'title'] },
          { model: DocumentSignature, as: 'signatures' }
        ]
      });
      res.status(201).json(results);
    }
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
    const { propertyId, dealId, sellerId, teamUserId, type, includePropertyDocs } = req.query;
    let where = {};
    let propertyDocuments = [];
    
    if (propertyId) where.propertyId = propertyId;
    if (dealId) where.dealId = dealId;
    if (sellerId) where.sellerId = sellerId;
    if (teamUserId) where.teamUserId = teamUserId;
    if (type) where.type = type;

    const documents = await Document.findAll({
      where,
      include: [
        { 
          model: DocumentVersion, 
          as: 'versions',
          include: [{ model: User, as: 'uploader', attributes: ['id', 'name', 'email'] }]
        },
        { model: User, as: 'uploader', attributes: ['id', 'name', 'email'] },
        { model: Seller, as: 'seller', attributes: ['id', 'name', 'email', 'phone'] },
        { model: Team, as: 'team', attributes: ['id', 'name'] },
        { model: Property, as: 'property', attributes: ['id', 'title'] },
        { model: DocumentSignature, as: 'signatures' }
      ],
      order: [['updatedAt', 'DESC']]
    });

    if (dealId && includePropertyDocs !== 'false') {
      const deal = await require('../models/associations').Deal.findByPk(dealId);
      if (deal && deal.propertyId) {
        propertyDocuments = await Document.findAll({
          where: {
            propertyId: deal.propertyId,
            dealId: { [Op.or]: [null, { [Op.eq]: dealId }] }
          },
          include: [
            { 
              model: DocumentVersion, 
              as: 'versions',
              include: [{ model: User, as: 'uploader', attributes: ['id', 'name', 'email'] }]
            },
            { model: User, as: 'uploader', attributes: ['id', 'name', 'email'] },
            { model: Property, as: 'property', attributes: ['id', 'title'] }
          ],
          order: [['updatedAt', 'DESC']]
        });
      }
    }

    const allDocuments = [...documents];
    const dealDocIds = new Set(documents.map(d => d.id));
    propertyDocuments.forEach(doc => {
      if (!dealDocIds.has(doc.id)) {
        allDocuments.push({ ...doc.toJSON(), isPropertyDocument: true });
      }
    });

    res.status(200).json(allDocuments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching documents', error: error.message });
  }
};

exports.signDocument = async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    if (!document.isDigitalSignatureEnabled) {
      return res.status(400).json({ message: 'Digital signature not enabled for this document' });
    }

    const { signerType } = req.body;
    let signers = document.signers || [];
    
    if (signers.length > 0) {
      signers = signers.map(signer => {
        if (signer.type === signerType) {
          return {
            ...signer,
            status: 'signed',
            signedAt: new Date(),
            signedByUserId: req.user.id
          };
        }
        return signer;
      });

      const allSigned = signers.every(s => s.status === 'signed');
      
      await document.update({
        signers,
        status: allSigned ? 'Signed' : 'Pending Signature',
        signedAt: allSigned ? new Date() : null
      });

      const signatureRecord = await DocumentSignature.findOne({
        where: { documentId: document.id, signerType }
      });
      if (signatureRecord) {
        await signatureRecord.update({
          status: 'signed',
          signedAt: new Date(),
          signedIpAddress: req.ip,
          signedUserAgent: req.headers['user-agent']
        });
      }
    } else {
      await document.update({
        status: 'Signed',
        signedAt: new Date(),
        signedByUserId: req.user.id
      });
    }

    res.status(200).json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error signing document', error: error.message });
  }
};

exports.generateSignatureLink = async (req, res) => {
  try {
    const { documentId, signerType, signerEmail, signerName } = req.body;
    
    const document = await Document.findByPk(documentId);
    if (!document) return res.status(404).json({ message: 'Document not found' });
    
    if (!document.isDigitalSignatureEnabled) {
      return res.status(400).json({ message: 'Digital signature not enabled for this document' });
    }

    const token = generateSignatureToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    let signature = await DocumentSignature.findOne({
      where: { documentId, signerType }
    });

    if (signature) {
      await signature.update({
        token,
        tokenExpiresAt: expiresAt,
        signerEmail: signerEmail || signature.signerEmail,
        signerName: signerName || signature.signerName,
        status: 'sent'
      });
    } else {
      signature = await DocumentSignature.create({
        documentId,
        signerType,
        signerEmail,
        signerName,
        token,
        tokenExpiresAt: expiresAt,
        status: 'sent'
      });
    }

    const signUrl = `${FRONTEND_URL}/sign/${documentId}/${token}`;
    
    if (signerEmail) {
      const property = await Property.findByPk(document.propertyId);
      await emailService.sendSignatureRequest({
        to: signerEmail,
        signerName: signerName || signature.signerName,
        documentTitle: document.title,
        signerType,
        signUrl,
        propertyTitle: property ? property.title : null,
        expiresIn: '7 days'
      });
    }

    res.status(200).json({
      signUrl,
      token,
      expiresAt,
      signerType,
      signerEmail,
      emailSent: !!signerEmail,
      message: signerEmail 
        ? 'Signature link generated and email sent successfully' 
        : 'Signature link generated successfully'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating signature link', error: error.message });
  }
};

exports.getPublicSigningData = async (req, res) => {
  try {
    const { documentId, token } = req.params;

    const signature = await DocumentSignature.findOne({
      where: { documentId, token }
    });

    if (!signature) {
      return res.status(404).json({ message: 'Invalid or expired signature link' });
    }

    if (signature.tokenExpiresAt && new Date() > signature.tokenExpiresAt) {
      await signature.update({ status: 'expired' });
      return res.status(410).json({ message: 'Signature link has expired' });
    }

    if (signature.status === 'signed') {
      return res.status(400).json({ message: 'Document has already been signed' });
    }

    const document = await Document.findByPk(documentId, {
      include: [
        { model: DocumentVersion, as: 'versions', order: [['versionNumber', 'DESC']] },
        { model: User, as: 'uploader', attributes: ['id', 'name', 'email'] },
        { model: Property, as: 'property', attributes: ['id', 'title', 'address', 'city'] }
      ]
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    await signature.update({ status: 'viewed' });

    res.status(200).json({
      document: {
        id: document.id,
        title: document.title,
        type: document.type,
        status: document.status,
        currentVersion: document.currentVersion
      },
      version: document.versions[0],
      property: document.property,
      uploader: document.uploader,
      signerType: signature.signerType,
      signerName: signature.signerName,
      canSign: signature.status !== 'signed' && signature.status !== 'expired'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching signing data', error: error.message });
  }
};

exports.processPublicSignature = async (req, res) => {
  try {
    const { documentId, token } = req.params;
    const { signerName, agreedToTerms } = req.body;

    if (!agreedToTerms) {
      return res.status(400).json({ message: 'You must agree to the terms to sign' });
    }

    const signature = await DocumentSignature.findOne({
      where: { documentId, token }
    });

    if (!signature) {
      return res.status(404).json({ message: 'Invalid or expired signature link' });
    }

    if (signature.tokenExpiresAt && new Date() > signature.tokenExpiresAt) {
      await signature.update({ status: 'expired' });
      return res.status(410).json({ message: 'Signature link has expired' });
    }

    if (signature.status === 'signed') {
      return res.status(400).json({ message: 'Document has already been signed' });
    }

    const document = await Document.findByPk(documentId, {
      include: [{ model: DocumentVersion, as: 'versions', order: [['versionNumber', 'DESC']] }]
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const latestVersion = document.versions[0];
    const documentHash = generateDocumentHash(document, latestVersion);
    const signatureHash = crypto
      .createHash('sha256')
      .update(`${documentHash}-${signature.signerType}-${signerName || signature.signerName}-${Date.now()}`)
      .digest('hex');

    await signature.update({
      status: 'signed',
      signedAt: new Date(),
      signedIpAddress: req.ip,
      signedUserAgent: req.headers['user-agent'],
      signerName: signerName || signature.signerName,
      documentHash,
      signatureHash
    });

    const signers = document.signers || [];
    const updatedSigners = signers.map(s => {
      if (s.type === signature.signerType) {
        return { ...s, status: 'signed', signedAt: new Date() };
      }
      return s;
    });

    const allSigned = updatedSigners.length === 0 || updatedSigners.every(s => s.status === 'signed');
    
    await document.update({
      signers: updatedSigners,
      status: allSigned ? 'Signed' : 'Pending Signature',
      signedAt: allSigned ? new Date() : null,
      signatureHash: allSigned ? signatureHash : null
    });

    await Notification.create({
      userId: document.uploadedByUserId,
      title: 'Document Signed',
      message: `"${signature.signerType}" signed "${document.title}" ${allSigned ? '- All signatures complete' : ''}`,
      type: 'document',
      link: `/documents?docId=${document.id}`
    });

    const uploader = await User.findByPk(document.uploadedByUserId);
    if (uploader?.email) {
      const property = await Property.findByPk(document.propertyId);
      await emailService.sendSignatureCompleted({
        to: uploader.email,
        documentTitle: document.title,
        signerType: signature.signerType,
        allSigned,
        propertyTitle: property?.title
      });
    }

    res.status(200).json({
      success: true,
      message: 'Document signed successfully',
      signatureDetails: {
        signedAt: signature.signedAt,
        signerType: signature.signerType,
        signerName: signerName || signature.signerName,
        documentHash,
        signatureHash,
        ipAddress: req.ip
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing signature', error: error.message });
  }
};

exports.getSignatureCertificate = async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await Document.findByPk(documentId);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const signatures = await DocumentSignature.findAll({
      where: { documentId, status: 'signed' },
      order: [['signedAt', 'ASC']]
    });

    if (signatures.length === 0) {
      return res.status(404).json({ message: 'No signatures found for this document' });
    }

    const latestVersion = await DocumentVersion.findOne({
      where: { documentId },
      order: [['versionNumber', 'DESC']]
    });

    res.status(200).json({
      document: {
        id: document.id,
        title: document.title,
        type: document.type,
        status: document.status,
        signedAt: document.signedAt
      },
      version: latestVersion,
      signatures: signatures.map(s => ({
        signerType: s.signerType,
        signerName: s.signerName,
        signerEmail: s.signerEmail,
        signedAt: s.signedAt,
        ipAddress: s.signedIpAddress,
        userAgent: s.signedUserAgent,
        location: s.location,
        signatureHash: s.signatureHash,
        documentHash: s.documentHash
      })),
      generatedAt: new Date()
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating certificate', error: error.message });
  }
};

exports.updateDocument = async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const { visibility, signers, notes, propertyId, dealId, sellerId, teamUserId } = req.body;

    const updateData = {};
    if (visibility !== undefined) updateData.visibility = visibility;
    if (signers !== undefined) {
      updateData.signers = typeof signers === 'string' ? JSON.parse(signers) : signers;
    }
    if (notes !== undefined) updateData.notes = notes;
    if (propertyId !== undefined) updateData.propertyId = propertyId || null;
    if (dealId !== undefined) updateData.dealId = dealId || null;
    if (sellerId !== undefined) updateData.sellerId = sellerId || null;
    if (teamUserId !== undefined) updateData.teamUserId = teamUserId || null;

    await document.update(updateData);

    const result = await Document.findByPk(document.id, {
      include: [
        { 
          model: DocumentVersion, 
          as: 'versions',
          include: [{ model: User, as: 'uploader', attributes: ['id', 'name', 'email'] }]
        },
        { model: User, as: 'uploader', attributes: ['id', 'name', 'email'] },
        { model: Seller, as: 'seller', attributes: ['id', 'name', 'email', 'phone'] },
        { model: Team, as: 'team', attributes: ['id', 'name'] },
        { model: DocumentSignature, as: 'signatures' }
      ]
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error updating document', error: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    await DocumentSignature.destroy({ where: { documentId: document.id } });
    await DocumentVersion.destroy({ where: { documentId: document.id } });
    await document.destroy();
    
    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting document', error: error.message });
  }
};
