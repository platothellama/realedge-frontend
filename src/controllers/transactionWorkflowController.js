const { TransactionWorkflow, Deal, Property, Lead, User } = require('../models/associations');

const STAGES = ['offer_submitted', 'counter_offer', 'contract_pending', 'contract_signed', 'inspection', 'appraisal', 'mortgage_approval', 'closing', 'completed', 'cancelled'];

exports.getWorkflows = async (req, res) => {
  try {
    const { status, stage } = req.query;
    let where = {};
    if (stage) where.currentStage = stage;

    const workflows = await TransactionWorkflow.findAll({
      where,
      include: [
        { model: Deal, as: 'deal', attributes: ['id', 'title'] },
        { model: Property, as: 'property', attributes: ['id', 'title'] },
        { model: Lead, as: 'client', attributes: ['id', 'name', 'email', 'phone'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json(workflows);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching workflows', error: error.message });
  }
};

exports.createWorkflow = async (req, res) => {
  try {
    const { dealId } = req.body;
    
    const deal = await Deal.findByPk(dealId);
    if (!deal) return res.status(404).json({ message: 'Deal not found' });

    const workflow = await TransactionWorkflow.create({
      dealId,
      propertyId: deal.propertyId,
      clientId: deal.buyerLeadId || deal.sellerLeadId,
      currentStage: 'offer_submitted',
      stages: STAGES.map(s => ({ name: s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), status: 'pending', date: null }))
    });

    res.status(201).json(workflow);
  } catch (error) {
    res.status(400).json({ message: 'Error creating workflow', error: error.message });
  }
};

exports.updateWorkflowStage = async (req, res) => {
  try {
    const workflow = await TransactionWorkflow.findByPk(req.params.id);
    if (!workflow) return res.status(404).json({ message: 'Workflow not found' });

    const { stage, action, notes, documents, tasks } = req.body;
    
    const stages = workflow.stages;
    const currentIndex = stages.findIndex(s => s.name === workflow.currentStage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    
    if (action === 'advance' && currentIndex < stages.length - 1) {
      stages[currentIndex].status = 'completed';
      stages[currentIndex].date = new Date();
      stages[currentIndex + 1].status = 'in_progress';
      await workflow.update({
        currentStage: STAGES[currentIndex + 1],
        stages,
        notes: notes ? (workflow.notes + '\n\n' + notes) : workflow.notes
      });
    } else if (action === 'revert' && currentIndex > 0) {
      stages[currentIndex].status = 'pending';
      stages[currentIndex].date = null;
      stages[currentIndex - 1].status = 'in_progress';
      await workflow.update({
        currentStage: STAGES[currentIndex - 1],
        stages
      });
    } else if (action === 'update' && documents) {
      await workflow.update({
        documents: [...(workflow.documents || []), ...documents],
        notes
      });
    } else if (action === 'cancel') {
      stages[currentIndex].status = 'cancelled';
      await workflow.update({
        currentStage: 'cancelled',
        stages
      });
    }

    res.status(200).json(workflow);
  } catch (error) {
    res.status(400).json({ message: 'Error updating workflow', error: error.message });
  }
};

exports.getWorkflowStats = async (req, res) => {
  try {
    const byStage = await TransactionWorkflow.findAll({
      attributes: ['currentStage', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']],
      group: ['currentStage']
    });

    const activeWorkflows = await TransactionWorkflow.count({
      where: { currentStage: { [require('sequelize').Op.notIn]: ['completed', 'cancelled'] } }
    });

    const completedThisMonth = await TransactionWorkflow.count({
      where: {
        currentStage: 'completed',
        updatedAt: { [require('sequelize').Op.gte]: new Date(new Date().setDate(1)) }
      }
    });

    res.status(200).json({
      byStage: byStage.map(s => ({ stage: s.currentStage, count: Number(s.dataValues.count) })),
      activeWorkflows,
      completedThisMonth
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching workflow stats', error: error.message });
  }
};
