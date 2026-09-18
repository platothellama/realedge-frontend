const { Visit, Property, User, Lead } = require('../models/associations');

exports.getAllVisits = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    // Filter logic: Admin/Super Admin see all, others see their own assigned visits
    let whereClause = {};
    if (userRole !== 'Super Admin' && userRole !== 'Admin') {
      whereClause = { brokerId: userId };
    }

    // QA 2026-09-18: bounded list (same contract as leads: explicit
    // ?page/?limit returns {data, pagination}; the calendar keeps the raw
    // array, capped).
    const page = Math.min(Math.max(parseInt(req.query.page, 10) || 0, 0), 1000);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 200);
    const findOpts = {
      where: whereClause,
      include: [
        { model: Property, as: 'property', attributes: ['id', 'title', 'address', 'city'] },
        { model: User, as: 'broker', attributes: ['id', 'name', 'photo'] },
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'email', 'phone'] }
      ],
      order: [['visitDate', 'ASC']]
    };
    if (page > 0 && limit > 0) {
      findOpts.limit = limit;
      findOpts.offset = (page - 1) * limit;
      // distinct: includes multiply rows; count must count visits.
      findOpts.distinct = true;
      const { count, rows } = await Visit.findAndCountAll(findOpts);
      return res.status(200).json({
        data: rows,
        pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) }
      });
    }
    findOpts.limit = 2000;
    const visits = await Visit.findAll(findOpts);

    res.status(200).json(visits);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching visits', ...require('../utils/http').safeError(error) });
  }
};

exports.getVisitById = async (req, res) => {
  try {
    const visit = await Visit.findByPk(req.params.id, {
      include: [
        { model: Property, as: 'property' },
        { model: User, as: 'broker', attributes: ['id', 'name', 'photo'] },
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'email', 'phone'] }
      ]
    });

    if (!visit) return res.status(404).json({ message: 'Visit not found' });

    // Check permissions
    const userRole = req.user.role;
    const userId = req.user.id;
    if (userRole !== 'Super Admin' && userRole !== 'Admin' && visit.brokerId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.status(200).json(visit);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching visit', ...require('../utils/http').safeError(error) });
  }
};

exports.createVisit = async (req, res) => {
  try {
    const visitData = { ...req.body };
    // QA 2026-09-18: PK/timestamps never client-settable.
    for (const f of ['id', 'createdAt', 'updatedAt']) {
      delete visitData[f];
    }

    // QA hardening 2026-09-18: non-admins cannot create visits as other
    // brokers (rows would vanish from their list and pollute the victim's).
    const role = req.user?.role;
    if (role !== 'Super Admin' && role !== 'Admin') {
      visitData.brokerId = req.user.id;
    } else if (!visitData.brokerId) {
      visitData.brokerId = req.user.id;
    }

    const visit = await Visit.create(visitData);
    
    // TODO: Trigger client notifications (Email/SMS)
    // TODO: Google Calendar Sync Logic

    res.status(201).json(visit);
  } catch (error) {
    res.status(400).json({ message: 'Error creating visit', ...require('../utils/http').safeError(error) });
  }
};

exports.updateVisit = async (req, res) => {
  try {
    const visit = await Visit.findByPk(req.params.id);
    if (!visit) return res.status(404).json({ message: 'Visit not found' });

    // Check permissions
    const userRole = req.user.role;
    const userId = req.user.id;
    if (userRole !== 'Super Admin' && userRole !== 'Admin' && visit.brokerId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // QA hardening 2026-09-18: only admins may reassign a visit to another
    // broker (otherwise visits can be silently transferred away).
    const updateData = { ...req.body };
    for (const f of ['id', 'createdAt', 'updatedAt']) {
      delete updateData[f];
    }
    if (userRole !== 'Super Admin' && userRole !== 'Admin') {
      delete updateData.brokerId;
    }
    await visit.update(updateData);
    
    // TODO: Update Google Calendar Event

    res.status(200).json(visit);
  } catch (error) {
    res.status(400).json({ message: 'Error updating visit', ...require('../utils/http').safeError(error) });
  }
};

exports.deleteVisit = async (req, res) => {
  try {
    const visit = await Visit.findByPk(req.params.id);
    if (!visit) return res.status(404).json({ message: 'Visit not found' });

    // Check permissions
    const userRole = req.user.role;
    const userId = req.user.id;
    if (userRole !== 'Super Admin' && userRole !== 'Admin' && visit.brokerId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // TODO: Delete Google Calendar Event

    await visit.destroy();
    res.status(200).json({ message: 'Visit deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting visit', ...require('../utils/http').safeError(error) });
  }
};
