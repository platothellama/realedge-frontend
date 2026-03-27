const { Team, User } = require('../models/associations');

exports.getTeams = async (req, res) => {
  try {
    const { status, officeId } = req.query;
    let where = {};
    if (status) where.status = status;
    if (officeId) where.officeId = officeId;

    const teams = await Team.findAll({
      where,
      include: [
        { model: User, as: 'leader', attributes: ['id', 'name', 'photo'] },
        { model: Team, as: 'parentTeam', attributes: ['id', 'name'] },
        { model: User, as: 'members', attributes: ['id', 'name', 'photo'] }
      ],
      order: [['name', 'ASC']]
    });

    res.status(200).json(teams);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching teams', error: error.message });
  }
};

exports.createTeam = async (req, res) => {
  try {
    const team = await Team.create(req.body);
    res.status(201).json(team);
  } catch (error) {
    res.status(400).json({ message: 'Error creating team', error: error.message });
  }
};

exports.updateTeam = async (req, res) => {
  try {
    const team = await Team.findByPk(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    await team.update(req.body);
    res.status(200).json(team);
  } catch (error) {
    res.status(400).json({ message: 'Error updating team', error: error.message });
  }
};

exports.deleteTeam = async (req, res) => {
  try {
    const team = await Team.findByPk(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    await team.destroy();
    res.status(200).json({ message: 'Team deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting team', error: error.message });
  }
};

exports.addTeamMember = async (req, res) => {
  try {
    const { userId, teamId } = req.body;
    
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await user.update({ teamId });
    res.status(200).json({ message: 'Member added to team' });
  } catch (error) {
    res.status(400).json({ message: 'Error adding team member', error: error.message });
  }
};

exports.getTeamStats = async (req, res) => {
  try {
    const teams = await Team.findAll({
      include: [{ model: User, as: 'members', attributes: ['id'] }]
    });

    const teamStats = teams.map(team => ({
      id: team.id,
      name: team.name,
      memberCount: team.members ? team.members.length : 0,
      commissionSplit: team.commissionSplit,
      targetRevenue: team.targetRevenue
    }));

    res.status(200).json({
      totalTeams: teams.length,
      teams: teamStats
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching team stats', error: error.message });
  }
};
