const { Document, DocumentVersion, User } = require('../models/associations');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

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

    if (!document.isDigitalSignatureEnabled) {
      return res.status(400).json({ message: 'Digital signature not enabled for this document' });
    }

    await document.update({
      status: 'Signed',
      signatureStatus: 'signed',
      signedAt: new Date(),
      signedByUserId: req.user.id
    });

    res.status(200).json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error signing document', error: error.message });
  }
};

exports.generateSigningLink = async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    if (!document.isDigitalSignatureEnabled) {
      return res.status(400).json({ message: 'Digital signature not enabled for this document' });
    }

    const signingToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await document.update({
      signingToken,
      signingLinkExpiresAt: expiresAt,
      signatureStatus: 'pending'
    });

    const signingLink = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/sign/${document.id}/${signingToken}`;

    res.status(200).json({
      signingLink,
      expiresAt,
      documentId: document.id
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating signing link', error: error.message });
  }
};

exports.signDocumentByToken = async (req, res) => {
  try {
    const { id, token } = req.params;

    const document = await Document.findByPk(id);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    if (document.signingToken !== token) {
      return res.status(400).json({ message: 'Invalid signing token' });
    }

    if (document.signingLinkExpiresAt && new Date() > new Date(document.signingLinkExpiresAt)) {
      return res.status(400).json({ message: 'Signing link has expired' });
    }

    await document.update({
      status: 'Signed',
      signatureStatus: 'signed',
      signedAt: new Date(),
      signingToken: null,
      signingLinkExpiresAt: null
    });

    res.status(200).json({ message: 'Document signed successfully', document });
  } catch (error) {
    res.status(500).json({ message: 'Error signing document', error: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    // In a real app, we'd also delete files from disk
    await document.destroy();
    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting document', error: error.message });
  }
};

exports.getPublicSigningData = async (req, res) => {
  try {
    const { documentId, token } = req.params;

    const document = await Document.findByPk(documentId);
    if (!document) return res.status(404).json({ message: 'Document not found' });

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
    const { signerName, agreedToTerms } = req.body;

    if (!agreedToTerms) {
      return res.status(400).json({ message: 'You must agree to the terms' });
    }

    const document = await Document.findByPk(documentId);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    if (document.signingToken !== token) {
      return res.status(400).json({ message: 'Invalid signing token' });
    }

    if (document.signingLinkExpiresAt && new Date() > new Date(document.signingLinkExpiresAt)) {
      return res.status(400).json({ message: 'Signing link has expired' });
    }

    await document.update({
      status: 'Signed',
      signatureStatus: 'signed',
      signedAt: new Date(),
      signingToken: null,
      signingLinkExpiresAt: null
    });

    res.status(200).json({
      message: 'Document signed successfully',
      signatureDetails: {
        signerName,
        signedAt: document.signedAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing signature', error: error.message });
  }
};
