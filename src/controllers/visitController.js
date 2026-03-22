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

    const visits = await Visit.findAll({
      where: whereClause,
      include: [
        { model: Property, as: 'property', attributes: ['id', 'title', 'address', 'city'] },
        { model: User, as: 'broker', attributes: ['id', 'name', 'photo'] },
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'email', 'phone'] }
      ],
      order: [['visitDate', 'ASC']]
    });

    res.status(200).json(visits);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching visits', error: error.message });
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
    res.status(500).json({ message: 'Error fetching visit', error: error.message });
  }
};

exports.createVisit = async (req, res) => {
  try {
    const visitData = { ...req.body };
    
    // Auto-assign broker if not provided
    if (!visitData.brokerId) {
      visitData.brokerId = req.user.id;
    }

    const visit = await Visit.create(visitData);
    
    // TODO: Trigger client notifications (Email/SMS)
    // TODO: Google Calendar Sync Logic

    res.status(201).json(visit);
  } catch (error) {
    res.status(400).json({ message: 'Error creating visit', error: error.message });
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

    await visit.update(req.body);
    
    // TODO: Update Google Calendar Event

    res.status(200).json(visit);
  } catch (error) {
    res.status(400).json({ message: 'Error updating visit', error: error.message });
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
    res.status(500).json({ message: 'Error deleting visit', error: error.message });
  }
};
