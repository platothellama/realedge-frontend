const { Document, DocumentVersion, User } = require('../models/associations');
const path = require('path');
const fs = require('fs');

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { title, type, propertyId, dealId, isDigitalSignatureEnabled, userId: connectedUserId, teamId } = req.body;
    const userId = req.user.id;

    // Create the Document record
    const document = await Document.create({
      title,
      type,
      propertyId: propertyId || null,
      dealId: dealId || null,
      uploadedByUserId: userId,
      isDigitalSignatureEnabled: isDigitalSignatureEnabled === 'true',
      userId: connectedUserId || null,
      teamId: teamId || null
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
    const { propertyId, dealId, userId, teamId } = req.query;
    let where = {};
    if (propertyId) where.propertyId = propertyId;
    if (dealId) where.dealId = dealId;
    if (userId) where.userId = userId;
    if (teamId) where.teamId = teamId;

    const { Team } = require('../models/associations');

    const documents = await Document.findAll({
      where,
      include: [
        { 
          model: DocumentVersion, 
          as: 'versions',
          include: [{ model: User, as: 'uploader', attributes: ['name'] }]
        },
        { model: User, as: 'uploader', attributes: ['name'] },
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: Team, as: 'team', attributes: ['id', 'name'] }
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
      signedAt: new Date(),
      signedByUserId: req.user.id
    });

    res.status(200).json(document);
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
