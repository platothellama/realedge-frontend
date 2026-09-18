const { Project, Property } = require('../models/associations');

const PROJECT_FIELDS = ['name', 'developer', 'description', 'address', 'city', 'country', 'status', 'coverImage'];
const PROJECT_STATUSES = ['Planned', 'Under Construction', 'Completed'];

const pickProject = (body) => {
  const out = {};
  for (const f of PROJECT_FIELDS) {
    if (body && body[f] !== undefined) out[f] = body[f];
  }
  // Empty strings for optional text fields become NULL (keeps grouping clean).
  for (const f of ['developer', 'description', 'address', 'city', 'country', 'coverImage']) {
    if (out[f] === '') out[f] = null;
  }
  return out;
};

exports.getAllProjects = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const where = {};
    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { developer: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } }
      ];
    }
    const projects = await Project.findAll({
      where,
      include: [{
        model: Property,
        as: 'properties',
        attributes: ['id', 'title', 'price', 'status', 'type', 'city', 'listingType', 'bedrooms', 'bathrooms', 'area', 'photos']
      }],
      order: [['name', 'ASC']]
    });
    // Attach unit counts without an extra query per project.
    const data = projects.map((p) => {
      const json = p.toJSON();
      json.unitsCount = Array.isArray(json.properties) ? json.properties.length : 0;
      return json;
    });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching projects', ...require('../utils/http').safeError(error) });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [{
        model: Property,
        as: 'properties',
        attributes: ['id', 'title', 'price', 'status', 'type', 'city', 'address', 'listingType', 'bedrooms', 'bathrooms', 'area', 'photos', 'createdAt']
      }]
    });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching project', ...require('../utils/http').safeError(error) });
  }
};

exports.createProject = async (req, res) => {
  try {
    const data = pickProject(req.body);
    if (!data.name || !String(data.name).trim()) {
      return res.status(400).json({ message: 'Project name is required' });
    }
    if (data.status && !PROJECT_STATUSES.includes(data.status)) {
      return res.status(400).json({ message: `Status must be one of: ${PROJECT_STATUSES.join(', ')}` });
    }
    const project = await Project.create(data);
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ message: 'Error creating project', ...require('../utils/http').safeError(error) });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const data = pickProject(req.body);
    if (data.name !== undefined && !String(data.name).trim()) {
      return res.status(400).json({ message: 'Project name cannot be empty' });
    }
    if (data.status !== undefined && data.status !== null && !PROJECT_STATUSES.includes(data.status)) {
      return res.status(400).json({ message: `Status must be one of: ${PROJECT_STATUSES.join(', ')}` });
    }
    await project.update(data);
    res.status(200).json(project);
  } catch (error) {
    res.status(400).json({ message: 'Error updating project', ...require('../utils/http').safeError(error) });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Deleting a project must NOT delete its units — simply ungroup them.
    // Properties keep existing with projectId set back to NULL.
    await Property.update({ projectId: null }, { where: { projectId: project.id } });
    await project.destroy();
    res.status(200).json({ message: 'Project deleted successfully. Linked properties were kept and ungrouped.' });
  } catch (error) {
    console.error(`project delete failed for ${req.params.id}:`, error.message);
    const safe = process.env.NODE_ENV === 'production'
      ? 'Could not delete this project.'
      : 'Error deleting project';
    res.status(500).json({ message: safe });
  }
};
