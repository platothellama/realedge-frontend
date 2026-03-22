const { Property, Lead, Deal, User, Transaction, Commission } = require('../models/associations');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

exports.propertyValuation = async (req, res) => {
  try {
    const { propertyId } = req.body;
    
    const property = await Property.findByPk(propertyId);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    const similarProperties = await Property.findAll({
      where: {
        city: property.city,
        type: property.type,
        id: { [require('sequelize').Op.ne]: propertyId }
      },
      limit: 10
    });

    const avgPrice = similarProperties.length > 0 
      ? similarProperties.reduce((sum, p) => sum + Number(p.price), 0) / similarProperties.length 
      : property.price;
    
    const avgPricePerSqm = similarProperties.length > 0
      ? similarProperties.reduce((sum, p) => sum + (p.area > 0 ? Number(p.price) / p.area : 0), 0) / similarProperties.filter(p => p.area > 0).length
      : (property.price / property.area);

    const marketValue = avgPrice;
    const priceDifference = ((property.price - marketValue) / marketValue * 100).toFixed(1);
    
    const valuation = {
      propertyId: property.id,
      propertyTitle: property.title,
      currentPrice: property.price,
      estimatedMarketValue: marketValue,
      pricePerSqm: avgPricePerSqm,
      priceVsMarket: priceDifference + '%',
      comparableProperties: similarProperties.length,
      recommendation: priceDifference > 10 ? 'Consider reducing price' : priceDifference < -10 ? 'Price could be increased' : 'Price is competitive',
      confidence: similarProperties.length > 5 ? 'High' : similarProperties.length > 2 ? 'Medium' : 'Low'
    };

    await property.update({ marketValue, pricePerSqm: avgPricePerSqm });

    res.status(200).json(valuation);
  } catch (error) {
    res.status(500).json({ message: 'Error in valuation', error: error.message });
  }
};

exports.marketAnalysis = async (req, res) => {
  try {
    const { city, propertyType } = req.body;

    const properties = await Property.findAll({
      where: city ? { city, type: propertyType } : propertyType ? { type: propertyType } : {}
    });

    const deals = await Deal.findAll({
      include: [{ model: Property, as: 'property' }]
    });

    const totalListings = properties.length;
    const avgPrice = properties.length > 0 
      ? properties.reduce((sum, p) => sum + Number(p.price), 0) / properties.length 
      : 0;
    
    const soldDeals = deals.filter(d => d.dealStage === 'Closed');
    const avgSoldPrice = soldDeals.length > 0
      ? soldDeals.reduce((sum, d) => sum + Number(d.finalPrice || 0), 0) / soldDeals.length
      : 0;

    const pricePerSqm = properties.reduce((sum, p) => 
      sum + (p.area > 0 ? Number(p.price) / p.area : 0), 0) / (properties.filter(p => p.area > 0).length || 1);

    const marketTrends = [
      { metric: 'Active Listings', value: totalListings, trend: totalListings > 10 ? 'high' : 'low' },
      { metric: 'Avg. Listing Price', value: '$' + avgPrice.toLocaleString(), trend: 'stable' },
      { metric: 'Avg. Sold Price', value: '$' + avgSoldPrice.toLocaleString(), trend: avgSoldPrice > avgPrice ? 'up' : 'down' },
      { metric: 'Price/m²', value: '$' + pricePerSqm.toFixed(0), trend: 'stable' }
    ];

    const insights = [
      avgSoldPrice > avgPrice ? 'Properties are selling above asking price' : 'Properties are selling below asking price',
      totalListings > 20 ? "High inventory - buyer's market" : "Low inventory - seller's market",
      soldDeals.length > deals.length * 0.3 ? 'Strong sales conversion' : 'Sales conversion could be improved'
    ];

    res.status(200).json({
      marketTrends,
      insights,
      totalProperties: totalListings,
      totalDeals: deals.length,
      closedDeals: soldDeals.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error in market analysis', error: error.message });
  }
};

exports.leadScoring = async (req, res) => {
  try {
    const { leadId } = req.body;
    
    const lead = await Lead.findByPk(leadId);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    let score = 50;
    const factors = [];

    if (lead.budget) {
      if (lead.budget > 5000000) { score += 20; factors.push('High budget: $' + lead.budget.toLocaleString()); }
      else if (lead.budget > 2000000) { score += 10; factors.push('Medium-high budget'); }
      else { score += 5; factors.push('Standard budget'); }
    }

    if (lead.source === 'Referral') { score += 15; factors.push('Referral - high intent'); }
    else if (lead.source === 'Website') { score += 10; factors.push('Active research'); }
    else if (lead.source === 'Walk-in') { score += 20; factors.push('Walk-in - immediate interest'); }

    if (lead.status === 'Visit Scheduled') { score += 15; factors.push('Scheduled property visit'); }
    else if (lead.status === 'Negotiation') { score += 25; factors.push('In negotiation stage'); }
    else if (lead.status === 'Closed Deal') { score += 30; factors.push('Ready to close'); }

    if (lead.nationality) { score += 5; factors.push('Nationality provided'); }
    if (lead.preferredAreas) { score += 10; factors.push('Clear preferences'); }

    score = Math.min(100, score);

    const rating = score >= 80 ? 'Hot' : score >= 60 ? 'Warm' : 'Cold';
    const recommendation = score >= 80 ? 'Prioritize: Ready to buy' : 
                         score >= 60 ? 'Nurture: Regular follow-up needed' : 
                         'Educate: Provide market information';

    res.status(200).json({
      leadId: lead.id,
      leadName: lead.name,
      score,
      rating,
      factors,
      recommendation
    });
  } catch (error) {
    res.status(500).json({ message: 'Error in lead scoring', error: error.message });
  }
};

exports.generatePropertyDescription = async (req, res) => {
  try {
    const { propertyId } = req.body;
    
    const property = await Property.findByPk(propertyId);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    const prompt = `Write 2 paragraph property description:
${property.title} - ${property.type}, ${property.bedrooms}BR/${property.bathrooms}BA, ${property.area}m²
Location: ${property.city}, ${property.country}
Features: ${property.features?.join(', ') || 'N/A'}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200
    });

    const description = completion.choices[0].message.content;
    await property.update({ description });

    res.status(200).json({ description });
  } catch (error) {
    res.status(500).json({ message: 'Error generating description', error: error.message });
  }
};

exports.generateMarketingContent = async (req, res) => {
  try {
    const { propertyId, contentType } = req.body;
    
    const property = await Property.findByPk(propertyId);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    const prompts = {
      social_post: `Write Instagram/Facebook post for: ${property.title} - $${Number(property.price).toLocaleString()}, ${property.city}. ${property.bedrooms}BR/${property.bathrooms}BA. Add emojis, hashtags.`,
      ads_copy: `Write 3 ad variations for: ${property.title} $${Number(property.price).toLocaleString()}. Headline (25 chars), Description (70 chars).`,
      email: `Write email for client interested in: ${property.title} - $${Number(property.price).toLocaleString()}. Subject + body.`,
      default: `Highlight: ${property.title}, $${Number(property.price).toLocaleString()}, ${property.city}`
    };

    const prompt = prompts[contentType] || prompts.default;
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200
    });

    res.status(200).json({ content: completion.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ message: 'Error generating content', error: error.message });
  }
};

exports.predictiveAnalytics = async (req, res) => {
  try {
    const [properties, leads, deals, transactions] = await Promise.all([
      Property.findAll(),
      Lead.findAll(),
      Deal.findAll(),
      Transaction.findAll()
    ]);

    const totalRevenue = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const closedDeals = deals.filter(d => d.dealStage === 'Closed');
    const conversionRate = ((closedDeals.length / (leads.length || 1)) * 100).toFixed(1);

    const avgDaysToClose = closedDeals.length > 0 ? 45 : 0;
    const predictedRevenue = (totalRevenue * 1.2).toFixed(0);
    const leadGrowthRate = ((leads.length / 30) * 100).toFixed(0);

    const predictions = [
      { metric: 'Projected Revenue (30 days)', value: '$' + Number(predictedRevenue).toLocaleString(), confidence: 'Medium' },
      { metric: 'Expected New Leads', value: Math.floor(leads.length * 0.3), confidence: 'High' },
      { metric: 'Predicted Closures', value: Math.floor(closedDeals.length * 1.1), confidence: 'Medium' },
      { metric: 'Avg. Days to Close', value: avgDaysToClose + ' days', confidence: 'High' }
    ];

    res.status(200).json({
      currentMetrics: {
        totalRevenue,
        conversionRate,
        totalLeads: leads.length,
        activeListings: properties.length
      },
      predictions
    });
  } catch (error) {
    res.status(500).json({ message: 'Error in predictive analytics', error: error.message });
  }
};

const calculateLeadScore = (lead) => {
  let score = 50;
  const factors = [];

  if (lead.budget) {
    if (lead.budget > 5000000) { score += 20; factors.push('High budget: $' + Number(lead.budget).toLocaleString()); }
    else if (lead.budget > 2000000) { score += 10; factors.push('Medium-high budget'); }
    else { score += 5; factors.push('Standard budget'); }
  }

  if (lead.source === 'Referral') { score += 15; factors.push('Referral - high intent'); }
  else if (lead.source === 'Website') { score += 10; factors.push('Active research'); }
  else if (lead.source === 'Walk-in') { score += 20; factors.push('Walk-in - immediate interest'); }

  if (lead.status === 'Visit Scheduled') { score += 15; factors.push('Scheduled property visit'); }
  else if (lead.status === 'Negotiation') { score += 25; factors.push('In negotiation stage'); }
  else if (lead.status === 'Closed Deal') { score += 30; factors.push('Ready to close'); }
  else if (lead.status === 'Contacted') { score += 10; factors.push('Been contacted'); }

  if (lead.nationality) { score += 5; factors.push('Nationality provided'); }
  if (lead.preferredAreas) { score += 10; factors.push('Clear preferences'); }
  if (lead.interestedIn) { score += 10; factors.push('Specific property interest'); }

  score = Math.min(100, score);

  return { score, factors };
};

exports.getAllLeadScores = async (req, res) => {
  try {
    const leads = await Lead.findAll({
      attributes: ['id', 'name', 'email', 'phone', 'status', 'budget', 'source', 'nationality', 'preferredAreas', 'interestedIn', 'score', 'createdAt']
    });

    const leadScores = leads.map(lead => {
      const { score: calculatedScore, factors } = calculateLeadScore(lead);
      const finalScore = lead.score || calculatedScore;
      const rating = finalScore >= 80 ? 'Hot' : finalScore >= 60 ? 'Warm' : 'Cold';
      const recommendation = finalScore >= 80 ? 'Priority follow-up' : 
                           finalScore >= 60 ? 'Schedule viewing' : 
                           finalScore >= 40 ? 'Nurture relationship' : 'Re-engage campaign';

      return {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        score: finalScore,
        rating,
        factors,
        recommendation,
        status: lead.status,
        source: lead.source,
        budget: lead.budget,
        createdAt: lead.createdAt
      };
    }).sort((a, b) => b.score - a.score);

    const hotLeads = leadScores.filter(l => l.score >= 80).length;
    const warmLeads = leadScores.filter(l => l.score >= 60 && l.score < 80).length;
    const coldLeads = leadScores.filter(l => l.score < 60).length;

    res.status(200).json({
      leads: leadScores,
      summary: {
        total: leadScores.length,
        hot: hotLeads,
        warm: warmLeads,
        cold: coldLeads,
        avgScore: leadScores.length > 0 ? Math.round(leadScores.reduce((sum, l) => sum + l.score, 0) / leadScores.length) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching lead scores', error: error.message });
  }
};

exports.getAllPropertyValuations = async (req, res) => {
  try {
    const properties = await Property.findAll({
      attributes: ['id', 'title', 'price', 'area', 'city', 'type', 'status', 'bedrooms', 'bathrooms', 'pricePerSqm', 'marketValue', 'createdAt']
    });

    const valuations = await Promise.all(properties.map(async (property) => {
      const similarProperties = await Property.findAll({
        where: {
          city: property.city,
          type: property.type,
          id: { [require('sequelize').Op.ne]: property.id }
        },
        attributes: ['id', 'price', 'area']
      });

      const avgPrice = similarProperties.length > 0 
        ? similarProperties.reduce((sum, p) => sum + Number(p.price), 0) / similarProperties.length 
        : Number(property.price);
      
      const avgPricePerSqm = similarProperties.length > 0
        ? similarProperties.reduce((sum, p) => sum + (p.area > 0 ? Number(p.price) / p.area : 0), 0) / similarProperties.filter(p => p.area > 0).length
        : (property.area > 0 ? Number(property.price) / property.area : 0);

      const marketValue = avgPrice;
      const priceDiff = Number(property.price) - marketValue;
      const priceDiffPercent = ((priceDiff / marketValue) * 100);
      
      const marketTrend = priceDiffPercent > 5 ? 'Rising' : priceDiffPercent < -5 ? 'Declining' : 'Stable';
      const confidence = similarProperties.length > 5 ? 90 : similarProperties.length > 2 ? 75 : 50;

      return {
        propertyId: property.id,
        propertyTitle: property.title,
        currentPrice: Number(property.price),
        estimatedValue: marketValue,
        pricePerSqm: avgPricePerSqm,
        marketTrend,
        confidence,
        comparableCount: similarProperties.length,
        priceVsMarket: priceDiffPercent > 0 ? `+${priceDiffPercent.toFixed(1)}%` : `${priceDiffPercent.toFixed(1)}%`,
        status: property.status,
        type: property.type,
        city: property.city
      };
    }));

    const avgValuation = valuations.length > 0 
      ? valuations.reduce((sum, v) => sum + v.estimatedValue, 0) / valuations.length 
      : 0;
    const undervalued = valuations.filter(v => v.estimatedValue > v.currentPrice).length;
    const overpriced = valuations.filter(v => v.estimatedValue < v.currentPrice).length;

    res.status(200).json({
      valuations: valuations.sort((a, b) => Math.abs(b.priceVsMarket) - Math.abs(a.priceVsMarket)),
      summary: {
        total: valuations.length,
        avgValuation: avgValuation,
        undervalued,
        overpriced,
        avgConfidence: valuations.length > 0 ? Math.round(valuations.reduce((sum, v) => sum + v.confidence, 0) / valuations.length) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching property valuations', error: error.message });
  }
};

exports.getAiInsights = async (req, res) => {
  try {
    const [properties, leads, deals, transactions] = await Promise.all([
      Property.findAll(),
      Lead.findAll(),
      Deal.findAll(),
      Transaction.findAll()
    ]);

    const closedDeals = deals.filter(d => d.dealStage === 'Closed');
    const totalRevenue = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const leadScores = leads.map(lead => {
      const { score } = calculateLeadScore(lead);
      return { ...lead.toJSON(), calculatedScore: score };
    }).sort((a, b) => (b.score || b.calculatedScore) - (a.score || a.calculatedScore));

    const hotLeads = leadScores.filter(l => (l.score || l.calculatedScore) >= 80).length;
    const warmLeads = leadScores.filter(l => {
      const s = l.score || l.calculatedScore;
      return s >= 60 && s < 80;
    }).length;

    const avgPrice = properties.length > 0 
      ? properties.reduce((sum, p) => sum + Number(p.price), 0) / properties.length 
      : 0;
    const avgPricePerSqm = properties.filter(p => p.area > 0).length > 0
      ? properties.reduce((sum, p) => sum + (p.area > 0 ? Number(p.price) / p.area : 0), 0) / properties.filter(p => p.area > 0).length
      : 0;

    const conversionRate = leads.length > 0 ? ((closedDeals.length / leads.length) * 100) : 0;
    const avgDealValue = closedDeals.length > 0 
      ? closedDeals.reduce((sum, d) => sum + Number(d.commission || 0), 0) / closedDeals.length 
      : 0;

    const predictions = [
      {
        type: 'revenue',
        title: 'Projected Monthly Revenue',
        value: `$${Math.round(totalRevenue * 1.15).toLocaleString()}`,
        confidence: 75,
        trend: 'up',
        description: `Based on ${closedDeals.length} closed deals and ${transactions.length} transactions. ${totalRevenue > 0 ? '15% growth projected.' : 'Start closing deals to generate revenue.'}`
      },
      {
        type: 'deals',
        title: 'Deals Expected This Month',
        value: closedDeals.length > 0 ? Math.ceil(closedDeals.length * 1.2).toString() : '0',
        confidence: 70,
        trend: closedDeals.length > 0 ? 'up' : 'stable',
        description: `Based on current pipeline of ${deals.length} deals. ${deals.filter(d => d.dealStage !== 'Closed').length} in progress.`
      },
      {
        type: 'leads',
        title: 'New Leads Expected',
        value: Math.ceil(leads.length * 0.3).toString(),
        confidence: 80,
        trend: leads.length > 0 ? 'up' : 'stable',
        description: `Based on ${leads.length} total leads. ${hotLeads} hot leads ready for conversion.`
      },
      {
        type: 'conversion',
        title: 'Predicted Conversion Rate',
        value: `${Math.min(100, Math.round(conversionRate * 1.1))}%`,
        confidence: 65,
        trend: conversionRate > 10 ? 'up' : 'stable',
        description: `Current rate: ${conversionRate.toFixed(1)}%. Based on ${closedDeals.length} closed from ${leads.length} leads.`
      },
      {
        type: 'inventory',
        title: 'Properties Likely to Sell (30 days)',
        value: `${Math.round(properties.filter(p => p.status === 'Available').length * 0.7)}`,
        confidence: 75,
        trend: 'up',
        description: `Based on ${properties.filter(p => p.status === 'Available').length} available properties. Market absorption rate estimated at 70%.`
      },
      {
        type: 'churn',
        title: 'Leads Needing Attention',
        value: warmLeads.toString(),
        confidence: 85,
        trend: warmLeads > 10 ? 'up' : 'down',
        description: `${warmLeads} warm leads need follow-up to prevent churn. Priority: Contact within 48 hours.`
      }
    ];

    const leadScoreData = leadScores.slice(0, 10).map(lead => {
      const finalScore = lead.score || lead.calculatedScore;
      const factors = [];
      if (lead.budget) factors.push(lead.budget > 2000000 ? 'High budget' : 'Has budget');
      if (lead.source) factors.push(`${lead.source} source`);
      if (lead.status) factors.push(`${lead.status} status`);
      
      return {
        id: lead.id,
        name: lead.name,
        score: finalScore,
        factors: factors.length > 0 ? factors : ['New lead'],
        recommendation: finalScore >= 80 ? 'Priority follow-up' : finalScore >= 60 ? 'Schedule viewing' : 'Nurture relationship'
      };
    });

    const valuations = await Promise.all(properties.slice(0, 10).map(async (property) => {
      const similarProperties = await Property.findAll({
        where: { city: property.city, type: property.type, id: { [require('sequelize').Op.ne]: property.id } },
        attributes: ['price', 'area']
      });
      
      const avgSimilarPrice = similarProperties.length > 0
        ? similarProperties.reduce((sum, p) => sum + Number(p.price), 0) / similarProperties.length
        : Number(property.price);
      
      const marketTrend = avgSimilarPrice > Number(property.price) ? 'Rising' : avgSimilarPrice < Number(property.price) * 0.95 ? 'Declining' : 'Stable';
      
      return {
        propertyId: property.id,
        propertyTitle: property.title,
        currentPrice: Number(property.price),
        estimatedValue: avgSimilarPrice,
        pricePerSqm: property.area > 0 ? Number(property.price) / property.area : 0,
        marketTrend,
        confidence: Math.min(95, 50 + similarProperties.length * 10)
      };
    }));

    res.status(200).json({
      predictions,
      leadScores: leadScoreData,
      propertyValuations: valuations,
      summary: {
        totalLeads: leads.length,
        hotLeads,
        warmLeads,
        coldLeads: leads.length - hotLeads - warmLeads,
        totalProperties: properties.length,
        availableProperties: properties.filter(p => p.status === 'Available').length,
        soldProperties: properties.filter(p => p.status === 'Sold').length,
        totalDeals: deals.length,
        closedDeals: closedDeals.length,
        totalRevenue,
        avgPrice,
        avgPricePerSqm: Math.round(avgPricePerSqm),
        conversionRate: conversionRate.toFixed(1)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching AI insights', error: error.message });
  }
};

exports.matchPropertiesToLead = async (req, res) => {
  try {
    const { leadId } = req.body;
    
    const lead = await Lead.findByPk(leadId);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    let whereClause = { status: 'Available' };
    
    if (lead.budget) {
      const budgetNum = Number(lead.budget);
      whereClause.price = { [require('sequelize').Op.lte]: budgetNum * 1.2 };
    }
    
    if (lead.propertyPreferences) {
      whereClause.type = lead.propertyPreferences;
    }

    const properties = await Property.findAll({
      where: whereClause,
      attributes: ['id', 'title', 'price', 'area', 'city', 'type', 'bedrooms', 'bathrooms', 'status']
    });

    const scoredProperties = properties.map(property => {
      let score = 50;
      const matchingReasons = [];

      if (lead.budget && Number(property.price) <= Number(lead.budget)) {
        score += 20;
        matchingReasons.push('Within budget');
      }

      if (lead.propertyPreferences && property.type === lead.propertyPreferences) {
        score += 15;
        matchingReasons.push('Matches preferred type');
      }

      if (lead.preferredAreas && property.city && lead.preferredAreas.toLowerCase().includes(property.city.toLowerCase())) {
        score += 15;
        matchingReasons.push('In preferred area');
      }

      if (property.area > 100) {
        score += 5;
        matchingReasons.push('Good size');
      }

      return {
        property,
        score: Math.min(100, score),
        matchingReasons
      };
    }).sort((a, b) => b.score - a.score);

    const topMatches = scoredProperties.slice(0, 10);
    
    let aiAnalysis = '';
    if (process.env.OPENAI_API_KEY && topMatches.length > 0) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{
            role: "system",
            content: "You are a real estate AI assistant. Provide brief, actionable insights about property matches for a client."
          }, {
            role: "user",
            content: `Client: ${lead.name}, Budget: $${lead.budget || 'Not specified'}, Preferences: ${lead.propertyPreferences || 'Any'}, Preferred Areas: ${lead.preferredAreas || 'Any'}. 
            
Top 3 properties found:
${topMatches.slice(0, 3).map((m, i) => `${i+1}. ${m.property.title} - $${m.property.price} - ${m.property.city}`).join('\n')}

Provide a brief recommendation for the agent.`
          }],
          max_tokens: 200
        });
        aiAnalysis = completion.choices[0]?.message?.content || '';
      } catch (aiError) {
        console.log('AI analysis unavailable:', aiError.message);
      }
    }

    res.status(200).json({
      lead: { id: lead.id, name: lead.name, budget: lead.budget, preferences: lead.propertyPreferences },
      matches: topMatches,
      totalFound: properties.length,
      aiAnalysis
    });
  } catch (error) {
    res.status(500).json({ message: 'Error matching properties', error: error.message });
  }
};

exports.generatePropertyListing = async (req, res) => {
  try {
    const { propertyId, includeSections } = req.body;
    
    const property = await Property.findByPk(propertyId);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    const sections = includeSections || ['description', 'seo', 'social', 'ad'];
    const results = {};

    const propertyInfo = `
Property: ${property.title}
Type: ${property.type}
Price: $${Number(property.price).toLocaleString()}
Location: ${property.city}, ${property.country}
Bedrooms: ${property.bedrooms}, Bathrooms: ${property.bathrooms}
Area: ${property.area} sqm
Features: ${property.features?.join(', ') || 'N/A'}
    `;

    if (sections.includes('description') || sections.includes('all')) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{
            role: "system",
            content: "You are a luxury real estate copywriter. Write a premium, marketing-style property description (3-4 paragraphs) that highlights unique features and creates desire."
          }, {
            role: "user",
            content: propertyInfo
          }],
          max_tokens: 500
        });
        results.description = completion.choices[0]?.message?.content || '';
      } catch (e) {
        results.description = 'AI description generation unavailable';
      }
    }

    if (sections.includes('seo') || sections.includes('all')) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{
            role: "system",
            content: "You are an SEO expert. Generate an SEO-optimized title and meta description for a property listing."
          }, {
            role: "user",
            content: `${propertyInfo}\n\nGenerate: 1. SEO Title (max 60 chars) 2. Meta Description (max 160 chars) 3. 5 SEO Keywords`
          }],
          max_tokens: 200
        });
        results.seo = completion.choices[0]?.message?.content || '';
      } catch (e) {
        results.seo = 'AI SEO generation unavailable';
      }
    }

    if (sections.includes('social') || sections.includes('all')) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{
            role: "system",
            content: "You are a social media expert. Create engaging social media posts for a luxury property."
          }, {
            role: "user",
            content: `${propertyInfo}\n\nGenerate: 1. Instagram caption 2. Facebook post 3. Twitter/X thread (3 tweets)`
          }],
          max_tokens: 400
        });
        results.social = completion.choices[0]?.message?.content || '';
      } catch (e) {
        results.social = 'AI social media generation unavailable';
      }
    }

    if (sections.includes('ad') || sections.includes('all')) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{
            role: "system",
            content: "Write ad copy for Google/Facebook ads."
          }, {
            role: "user",
            content: `${propertyInfo}\n\n3 ad variations: Headline (25 chars), Description (70 chars).`
          }],
          max_tokens: 200
        });
        results.ads = completion.choices[0]?.message?.content || '';
      } catch (e) {
        results.ads = 'AI unavailable';
      }
    }

    res.status(200).json({
      propertyId: property.id,
      propertyTitle: property.title,
      generated: results
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating listing', error: error.message });
  }
};

exports.generateClientCommunication = async (req, res) => {
  try {
    const { leadId, templateType, customMessage } = req.body;
    
    const lead = await Lead.findByPk(leadId);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    let prompt = '';
    const context = `Client: ${lead.name}
Budget: $${lead.budget ? Number(lead.budget).toLocaleString() : 'Not specified'}
Preferences: ${lead.propertyPreferences || 'Not specified'}
Preferred Areas: ${lead.preferredAreas || 'Not specified'}
Status: ${lead.status}
    `;

    switch (templateType) {
      case 'intro':
        prompt = `Write a personalized introduction email for a real estate lead. Be warm, professional, and mention we're here to help them find their dream property.`;
        break;
      case 'property_match':
        prompt = `Write an email notifying the client about properties that match their criteria. Mention we've found great options and would love to schedule a viewing.`;
        break;
      case 'follow_up':
        prompt = `Write a friendly follow-up email checking if they're still interested and if they have any questions.`;
        break;
      case 'whatsapp':
        prompt = `Write a short, friendly WhatsApp message (max 150 words) to check in with the client.`;
        break;
      case 'custom':
        prompt = customMessage ? `Write a message incorporating: ${customMessage}` : 'Write a professional follow-up message';
        break;
      default:
        prompt = 'Write a professional real estate communication';
    }

    let generatedContent = '';
    if (process.env.OPENAI_API_KEY) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{
            role: "system",
            content: "Write personalized client communications."
          }, {
            role: "user",
            content: `Client: ${lead.name}, Budget: $${lead.budget || 'N/A'}, Status: ${lead.status}\n${prompt}`
          }],
          max_tokens: 250
        });
        generatedContent = completion.choices[0]?.message?.content || '';
      } catch (aiError) {
        generatedContent = 'AI unavailable. Try again.';
      }
    } else {
      generatedContent = 'OpenAI API key not configured';
    }

    res.status(200).json({
      lead: { id: lead.id, name: lead.name, email: lead.email },
      templateType,
      generated: generatedContent
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating communication', error: error.message });
  }
};

exports.generateMarketReport = async (req, res) => {
  try {
    const { city, reportType } = req.body;
    
    const whereClause = city ? { city } : {};
    const properties = await Property.findAll({ where: whereClause });
    const deals = await Deal.findAll({ where: { dealStage: 'Closed' } });
    const leads = await Lead.findAll();

    const avgPrice = properties.length > 0 
      ? properties.reduce((sum, p) => sum + Number(p.price), 0) / properties.length 
      : 0;
    
    const totalSales = deals.length;
    const avgDaysOnMarket = 45;

    const marketStats = {
      totalProperties: properties.length,
      availableProperties: properties.filter(p => p.status === 'Available').length,
      avgPrice: Math.round(avgPrice),
      totalSales,
      activeLeads: leads.length,
      conversionRate: leads.length > 0 ? (totalSales / leads.length * 100).toFixed(1) : 0
    };

    let report = '';
    if (process.env.OPENAI_API_KEY) {
      const reportTypes = {
        'investment': 'Generate a real estate investment report highlighting best areas for investment, rental yields, and growth potential.',
        'market_overview': 'Generate a comprehensive market overview including trends, prices, inventory, and recommendations.',
        'quarterly': 'Generate a quarterly market report with key metrics, highlights, and forecasts.',
        'neighborhood': 'Generate a neighborhood analysis comparing this area to broader market trends.'
      };

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{
            role: "system",
            content: "Real estate market analyst."
          }, {
            role: "user",
            content: `Market: ${marketStats.totalProperties} props, $${marketStats.avgPrice.toLocaleString()} avg, ${marketStats.totalSales} sales.\nGenerate ${reportType || 'overview'} report.`
          }],
          max_tokens: 400
        });
        report = completion.choices[0]?.message?.content || '';
      } catch (aiError) {
        report = 'AI unavailable';
      }
    } else {
      report = 'OpenAI API key not configured';
    }

    res.status(200).json({
      city: city || 'All Areas',
      reportType: reportType || 'market_overview',
      stats: marketStats,
      report
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating market report', error: error.message });
  }
};

exports.getInvestmentRecommendations = async (req, res) => {
  try {
    const { budget, riskTolerance, strategy, location } = req.body;
    
    let whereClause = { status: 'Available' };
    
    if (budget) {
      whereClause.price = { [require('sequelize').Op.lte]: budget * 1.1 };
    }
    
    if (location) {
      whereClause.city = location;
    }

    const properties = await Property.findAll({ where: whereClause });

    const recommendations = properties.map(property => {
      let score = 50;
      const factors = [];

      if (property.price <= budget * 0.8) {
        score += 20;
        factors.push('Below budget - good margin');
      }

      if (property.area > 100) {
        score += 10;
        factors.push('Good size for rental');
      }

      if (property.status === 'Available') {
        score += 5;
        factors.push('Available for quick acquisition');
      }

      const estimatedRental = Number(property.price) * 0.005;
      const annualRental = estimatedRental * 12;
      const rentalYield = (annualRental / Number(property.price)) * 100;

      return {
        property: {
          id: property.id,
          title: property.title,
          price: Number(property.price),
          area: property.area,
          city: property.city,
          type: property.type
        },
        investmentScore: Math.min(100, score),
        factors,
        estimatedRental: Math.round(estimatedRental),
        annualRental: Math.round(annualRental),
        rentalYield: rentalYield.toFixed(1)
      };
    }).sort((a, b) => b.investmentScore - a.investmentScore);

    let aiAnalysis = '';
    if (process.env.OPENAI_API_KEY && recommendations.length > 0) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{
            role: "system",
            content: "Real estate investment advisor."
          }, {
            role: "user",
            content: `Budget: $${budget}, Strategy: ${strategy}, Location: ${location || 'Any'}\nTop picks: ${recommendations.slice(0, 3).map((r, i) => `${r.property.title} - $${r.property.price} - ${r.property.city} - Yield: ${r.rentalYield}%`).join(' | ')}\nGive brief advice.`
          }],
          max_tokens: 200
        });
        aiAnalysis = completion.choices[0]?.message?.content || '';
      } catch (aiError) {
        console.log('AI unavailable');
      }
    }

    res.status(200).json({
      criteria: { budget, riskTolerance, strategy, location },
      recommendations: recommendations.slice(0, 10),
      totalFound: properties.length,
      aiAnalysis
    });
  } catch (error) {
    res.status(500).json({ message: 'Error getting investment recommendations', error: error.message });
  }
};

const { Op } = require('sequelize');

const AI_MODEL = 'gpt-3.5-turbo';
const MAX_TOKENS_SHORT = 150;
const MAX_TOKENS_MEDIUM = 300;

const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const getCacheKey = (message, hasData) => `${message.toLowerCase().slice(0, 50)}_${hasData}`;
const getCached = (key) => {
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
  responseCache.delete(key);
  return null;
};
const setCache = (key, data) => {
  if (responseCache.size > 100) {
    const firstKey = responseCache.keys().next().value;
    responseCache.delete(firstKey);
  }
  responseCache.set(key, { data, timestamp: Date.now() });
};

const extractPropertyFilters = (query) => {
  const lowerQuery = query.toLowerCase();
  const filters = { priceMin: null, priceMax: null, bedrooms: null, bathrooms: null, propertyType: null, city: null, status: null, areaMin: null, areaMax: null };
  const priceRegex = /\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:k|million|m|b|billion)?/gi;
  const prices = [];
  let match;
  while ((match = priceRegex.exec(query)) !== null) {
    let price = parseFloat(match[1].replace(/,/g, ''));
    const m = match[0].toLowerCase();
    if (m.includes('k')) price *= 1000;
    else if (m.includes('million') || m.includes('m')) price *= 1000000;
    prices.push(price);
  }
  if (prices.length >= 2) { filters.priceMin = Math.min(...prices); filters.priceMax = Math.max(...prices); }
  else if (prices.length === 1) {
    if (lowerQuery.includes('less') || lowerQuery.includes('under') || lowerQuery.includes('below')) filters.priceMax = prices[0];
    else if (lowerQuery.includes('more') || lowerQuery.includes('over') || lowerQuery.includes('above')) filters.priceMin = prices[0];
    else { filters.priceMax = prices[0] * 1.2; filters.priceMin = prices[0] * 0.8; }
  }
  const bedroomMatch = query.match(/(\d+)\s*(?:bed|bedroom|br)/i);
  if (bedroomMatch) filters.bedrooms = parseInt(bedroomMatch[1]);
  const bathroomMatch = query.match(/(\d+)\s*(?:bath|bathroom|ba)/i);
  if (bathroomMatch) filters.bathrooms = parseInt(bathroomMatch[1]);
  const types = ['apartment', 'house', 'villa', 'office', 'land', 'commercial', 'penthouse', 'studio'];
  for (const t of types) { if (lowerQuery.includes(t)) { filters.propertyType = t.charAt(0).toUpperCase() + t.slice(1); break; } }
  const locs = [
    'beirut', 'byblos', 'jounieh', 'hamra', 'achrafieh', 'gemmayze', 'zahle', 'tyre', 'sidon',
    'mount lebanon', 'tripoli', 'baalbek', 'aley', 'chouf', 'keserwan', 'bcharreh', 'nabatieh',
    'badaro', 'baabda', 'baadba', 'antelias', 'dbayeh', 'jbeil', 'kaslik', 'broumana',
    'daychounieh', 'ain saadeh', 'tabarja', 'safra', 'ghostra', 'ajaltoun', 'ftneh',
    'zahle', 'zalhle', 'deir el qamar', 'beiteddine', 'saoufar', 'bhamdoun', 'souk el gharb',
    'mar mikhael', 'downtown', 'rue de bras', 'furn el chebbak', 'borj hammoud', 'dekwaneh',
    'sin el fil', 'hazmieh', 'ramlet baida', 'raouche', 'jnah', 'bachoura', 'mazraa', 'ras maska',
    'al-mina', 'abou samra', 'qobbeh', 'mina', 'sidion old city', 'bourj ech chemali', 'haret saida'
  ];
  for (const l of locs) { if (lowerQuery.includes(l)) { filters.city = l.charAt(0).toUpperCase() + l.slice(1); break; } }
  if (lowerQuery.includes('available') || lowerQuery.includes('for sale')) filters.status = 'Available';
  else if (lowerQuery.includes('sold')) filters.status = 'Sold';
  const areaMatch = query.match(/(\d+)\s*(?:sqm|sqm|square meter|square meters|m²|m2)/i);
  if (areaMatch) filters.areaMin = parseInt(areaMatch[1]) * 0.8;
  if (areaMatch) filters.areaMax = parseInt(areaMatch[1]) * 1.2;
  return filters;
};

const isPropertyQuery = (q) => ['property', 'properties', 'listing', 'apartment', 'house', 'villa', 'bedroom', 'find', 'search', 'show', 'list'].some(k => q.toLowerCase().includes(k));
const isLeadQuery = (q) => ['lead', 'leads', 'client', 'contact', 'buyer', 'prospect'].some(k => q.toLowerCase().includes(k));
const isDealQuery = (q) => ['deal', 'deals', 'negotiation', 'pipeline', 'closing', 'commission'].some(k => q.toLowerCase().includes(k));
const isRevenueQuery = (q) => ['revenue', 'income', 'expense', 'profit', 'financial', 'sales'].some(k => q.toLowerCase().includes(k));
const needsAI = (q) => ['why', 'what', 'how', 'recommend', 'suggest', 'explain', 'analyze', 'insight', 'think'].some(k => q.toLowerCase().includes(k));

const isMarketKnowledgeQuery = (q) => {
  const lowerQuery = q.toLowerCase();
  const marketKeywords = [
    'average price', 'avg price', 'market price', 'typical price', 'price range',
    'cost per sqm', 'price per sqm', 'price per square', 'per square meter',
    'market trends', 'market analysis', 'market value', 'investment potential',
    'rental yield', 'roi', 'return on investment', 'capital appreciation',
    'best area', 'best location', 'most expensive', 'cheapest', 'affordable',
    'is it worth', 'should i buy', 'good investment', 'market forecast',
    'how much does', 'what is the price', 'what would be the price',
    'growth rate', 'price appreciation', 'demand', 'supply', 'inventory'
  ];
  return marketKeywords.some(k => lowerQuery.includes(k));
};

const isSpecificPropertySearch = (q) => {
  const lowerQuery = q.toLowerCase();
  const searchKeywords = ['show me', 'find me', 'i want', 'looking for', 'need an', 'need a', 'search for', 'list properties', 'available properties'];
  const hasSearchIntent = searchKeywords.some(k => lowerQuery.includes(k));
  const hasSpecificCriteria = lowerQuery.includes('under $') || lowerQuery.includes('over $') || lowerQuery.includes('budget') || lowerQuery.includes('max') || lowerQuery.includes('min');
  return hasSearchIntent && hasSpecificCriteria;
};

const formatPrice = (p) => p >= 1000000 ? `$${(p / 1000000).toFixed(1)}M` : p >= 1000 ? `$${(p / 1000).toFixed(0)}K` : `$${p}`;
const fmtProp = (p) => ({ id: p.id, title: p.title, price: formatPrice(Number(p.price)), type: p.type, bedrooms: p.bedrooms, bathrooms: p.bathrooms, area: p.area, city: p.city, image: p.photos?.[0] || null });

exports.aiAssistant = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'Message is required' });

    const filters = extractPropertyFilters(message);
    const isProp = isPropertyQuery(message);
    const isLead = isLeadQuery(message);
    const isDeal = isDealQuery(message);
    const isRev = isRevenueQuery(message);
    const needsSummary = needsAI(message);
    const isMarketQuery = isMarketKnowledgeQuery(message);
    const isSpecificSearch = isSpecificPropertySearch(message);

    let propertyResults = null, leadResults = null, dealResults = null, revenueResults = null;
    const whereClause = {};

    // Skip property database search for market knowledge queries (e.g., "average price of apartments")
    // Use AI's training knowledge for these general market questions
    if (isProp && !isMarketQuery) {
      if (filters.priceMin || filters.priceMax || filters.propertyType || filters.city || filters.status || filters.bedrooms || filters.bathrooms || filters.areaMin || filters.areaMax || isSpecificSearch) {
        if (filters.priceMin) whereClause.price = { ...whereClause.price, [Op.gte]: filters.priceMin };
        if (filters.priceMax) whereClause.price = { ...whereClause.price, [Op.lte]: filters.priceMax };
        if (filters.propertyType) whereClause.type = filters.propertyType;
        if (filters.city) whereClause.city = { [Op.like]: `%${filters.city}%` };
        if (filters.status) whereClause.status = filters.status;
        if (filters.bedrooms) whereClause.bedrooms = { [Op.gte]: filters.bedrooms };
        if (filters.bathrooms) whereClause.bathrooms = { [Op.gte]: filters.bathrooms };
        if (filters.areaMin) whereClause.area = { ...whereClause.area, [Op.gte]: filters.areaMin };
        if (filters.areaMax) whereClause.area = { ...whereClause.area, [Op.lte]: filters.areaMax };
      } else whereClause.status = 'Available';
      
      const props = await Property.findAll({ where: whereClause, attributes: ['id', 'title', 'price', 'status', 'city', 'type', 'bedrooms', 'bathrooms', 'area', 'photos'], order: [['price', 'ASC']], limit: 20 });
      propertyResults = { count: props.length, properties: props.map(fmtProp) };
    }

    if (isLead) {
      const leads = await Lead.findAll({ attributes: ['id', 'name', 'status', 'budget', 'source'], order: [['createdAt', 'DESC']], limit: 30 });
      const byStatus = leads.reduce((a, l) => { a[l.status] = (a[l.status] || 0) + 1; return a; }, {});
      leadResults = { total: leads.length, hotCount: leads.filter(l => l.budget && Number(l.budget) > 2000000).length, byStatus, recent: leads.slice(0, 8).map(l => ({ id: l.id, name: l.name, budget: l.budget ? formatPrice(Number(l.budget)) : '-', status: l.status })) };
    }

    if (isDeal) {
      const deals = await Deal.findAll({ attributes: ['id', 'title', 'dealStage', 'commission', 'finalPrice'], order: [['createdAt', 'DESC']], limit: 30 });
      const open = deals.filter(d => d.dealStage !== 'Closed'), closed = deals.filter(d => d.dealStage === 'Closed');
      dealResults = { total: deals.length, open: open.length, closed: closed.length, pipeline: formatPrice(open.reduce((s, d) => s + Number(d.finalPrice || 0), 0)), commissions: formatPrice(closed.reduce((s, d) => s + Number(d.commission || 0), 0)) };
    }

    if (isRev) {
      const [txns, comms] = await Promise.all([
        Transaction.findAll({ attributes: ['id', 'type', 'amount'] }),
        Commission.findAll({ attributes: ['id', 'agentCommission', 'status'] })
      ]);
      const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
      const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
      const pending = comms.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.agentCommission || 0), 0);
      const paid = comms.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.agentCommission || 0), 0);
      revenueResults = { income: formatPrice(income), expenses: formatPrice(expenses), profit: formatPrice(income - expenses), pending: formatPrice(pending), paid: formatPrice(paid) };
    }

    const summary = { props: propertyResults?.count || 0, leads: leadResults?.total || 0, deals: dealResults?.total || 0, rev: revenueResults ? true : false };
    
    let response = '';
    const hasSpecificData = propertyResults || leadResults || dealResults || revenueResults;
    const cacheKey = getCacheKey(message, hasSpecificData);
    const cached = getCached(cacheKey);
    if (cached) { response = cached; }
    else if (process.env.OPENAI_API_KEY && hasSpecificData) {
      try {
        let dataSummary = `Data: ${summary.props} props, ${summary.leads} leads, ${summary.deals} deals`;
        if (propertyResults) dataSummary += `\nProps: ${propertyResults.properties.slice(0, 5).map(p => `${p.title} - ${p.price}`).join(' | ')}`;
        if (leadResults) dataSummary += `\nLeads: ${leadResults.total} (${leadResults.hotCount} hot)`;
        if (dealResults) dataSummary += `\nDeals: ${dealResults.open} open, ${dealResults.closed} closed`;
        if (revenueResults) dataSummary += `\nRevenue: ${revenueResults.income} income, ${revenueResults.profit} profit`;

        const systemPrompt = `RealEdge CRM assistant. ${dataSummary}. ${needsSummary ? 'Give brief insights.' : 'Just list/answer.'} Be concise.`;
        
        const completion = await openai.chat.completions.create({
          model: AI_MODEL,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: message }],
          max_tokens: needsSummary ? MAX_TOKENS_MEDIUM : MAX_TOKENS_SHORT
        });
        response = completion.choices[0]?.message?.content || '';
        setCache(cacheKey, response);
      } catch (err) { response = 'AI unavailable. Data shown below.'; }
    } else {
      if (propertyResults) response = `Found ${propertyResults.count} properties:\n` + propertyResults.properties.slice(0, 8).map(p => `• ${p.title} - ${p.price} (${p.bedrooms}BR/${p.bathrooms}BA, ${p.city})`).join('\n');
      else if (leadResults) response = `Leads: ${leadResults.total} total, ${leadResults.hotCount} hot\nBy status: ${JSON.stringify(leadResults.byStatus)}`;
      else if (dealResults) response = `Deals: ${dealResults.total} (${dealResults.open} open, ${dealResults.closed} closed)\nPipeline: ${dealResults.pipeline} | Commissions: ${dealResults.commissions}`;
      else if (revenueResults) response = `Income: ${revenueResults.income} | Expenses: ${revenueResults.expenses}\nProfit: ${revenueResults.profit} | Pending: ${revenueResults.pending}`;
      else response = `CRM has ${summary.props} properties, ${summary.leads} leads, ${summary.deals} deals. Try: "properties under $500K" or "hot leads"`;
    }

    res.status(200).json({ message, response, data: { properties: propertyResults, leads: leadResults, deals: dealResults, revenue: revenueResults, summary } });
  } catch (error) {
    res.status(500).json({ message: 'Error with AI assistant', error: error.message });
  }
};
