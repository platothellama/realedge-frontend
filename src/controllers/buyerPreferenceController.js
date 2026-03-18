const { Property, PropertyEmbedding, BuyerPreference, User, Lead } = require('../models/associations');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let localEmbedder = null;
let embeddingCache = new Map();

const SYNONYMS = {
  'flat': 'apartment',
  'suite': 'apartment',
  'studio': 'one-bedroom',
  'bedroom': 'bedrooms',
  'bed': 'bedrooms',
  'bath': 'bathrooms',
  'washroom': 'bathrooms',
  'toilet': 'bathrooms',
  'parking': 'parking space',
  'garage': 'parking space',
  'car park': 'parking space',
  'balcony': 'balcony',
  'terrace': 'balcony',
  'furnished': 'furnished',
  'unfurnished': 'unfurnished',
  'empty': 'unfurnished',
  'modern': 'modern',
  'luxury': 'luxurious',
  'spacious': 'spacious',
  'cozy': 'cozy',
  'quiet': 'quiet',
  'peaceful': 'quiet',
  'downtown': 'city center',
  'city center': 'downtown',
  'subway': 'metro',
  'metro': 'subway',
  'train': 'metro',
  'bus': 'public transport',
  'school': 'schools',
  'university': 'universities',
  'gym': 'fitness center',
  'fitness': 'gym',
  'pool': 'swimming pool',
  'garden': 'garden',
  'yard': 'garden',
  'view': 'view',
  'sea view': 'ocean view',
  'ocean': 'sea',
  'mountain': 'mountains',
  'city view': 'urban view',
  'cheap': 'affordable',
  'inexpensive': 'affordable',
  'budget': 'affordable',
  'renovated': 'renovated',
  'new': 'new construction',
  'brand new': 'new construction'
};

const PRIORITY_FEATURES = [
  'parking', 'balcony', 'garden', 'pool', 'gym', 'security', 'furnished',
  'elevator', 'air conditioning', 'heating', 'wifi', 'pets allowed'
];

const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (magA * magB);
};

const expandQuery = (query) => {
  const words = query.toLowerCase().split(/\s+/);
  const expanded = [...words];
  
  words.forEach(word => {
    const cleanWord = word.replace(/[^a-z]/g, '');
    if (SYNONYMS[cleanWord] && !expanded.includes(SYNONYMS[cleanWord])) {
      expanded.push(SYNONYMS[cleanWord]);
    }
  });
  
  return expanded.join(' ');
};

const extractFeaturesFromQuery = (query) => {
  const lowerQuery = query.toLowerCase();
  const foundFeatures = [];
  
  PRIORITY_FEATURES.forEach(feature => {
    if (lowerQuery.includes(feature)) {
      foundFeatures.push(feature);
    }
  });
  
  return foundFeatures;
};

const extractPriceRange = (query) => {
  const priceRegex = /\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:k|million)?/gi;
  const prices = [];
  let match;
  
  while ((match = priceRegex.exec(query)) !== null) {
    let price = parseFloat(match[1].replace(/,/g, ''));
    if (match[0].toLowerCase().includes('k')) {
      price *= 1000;
    } else if (match[0].toLowerCase().includes('million')) {
      price *= 1000000;
    }
    prices.push(price);
  }
  
  return prices.length >= 2 
    ? { min: Math.min(...prices), max: Math.max(...prices) }
    : prices.length === 1 
      ? { max: prices[0] * 1.2 }
      : null;
};

const extractBedrooms = (query) => {
  const bedroomRegex = /(\d+)\s*(?:bed|bedroom|br)/gi;
  const match = bedroomRegex.exec(query);
  return match ? parseInt(match[1]) : null;
};

const extractBathrooms = (query) => {
  const bathroomRegex = /(\d+)\s*(?:bath|bathroom|ba)/gi;
  const match = bathroomRegex.exec(query);
  return match ? parseInt(match[1]) : null;
};

const initLocalEmbedder = async () => {
  if (localEmbedder) return localEmbedder;
  
  try {
    const { pipeline } = require('@xenova/transformers');
    localEmbedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Local embedding model loaded: all-MiniLM-L6-v2');
    return localEmbedder;
  } catch (error) {
    console.log('Local embedder not available:', error.message);
    return null;
  }
};

const generateLocalEmbedding = async (text) => {
  try {
    if (!localEmbedder) {
      await initLocalEmbedder();
    }
    if (!localEmbedder) return null;
    
    const cacheKey = text.substring(0, 100);
    if (embeddingCache.has(cacheKey)) {
      return embeddingCache.get(cacheKey);
    }
    
    const output = await localEmbedder(text, {
      pooling: 'mean',
      normalize: true
    });
    
    const embedding = Array.from(output.data);
    embeddingCache.set(cacheKey, embedding);
    
    if (embeddingCache.size > 1000) {
      const firstKey = embeddingCache.keys().next().value;
      embeddingCache.delete(firstKey);
    }
    
    return embedding;
  } catch (error) {
    console.error('Local embedding error:', error.message);
    return null;
  }
};

const buildPropertyText = (property) => {
  const features = Array.isArray(property.features) ? property.features.join(', ') : '';
  const featureDescriptions = [
    property.parkingSpaces > 0 ? 'parking available' : '',
    property.balcony ? 'has balcony' : '',
    property.furnished ? 'furnished' : '',
    property.floor ? `floor ${property.floor}` : '',
    property.view ? `${property.view} view` : ''
  ].filter(Boolean).join(', ');
  
  return `${property.title} ${property.description || ''} ${features} ${featureDescriptions} ${property.city} ${property.address} ${property.type}`.trim();
};

const generateEmbedding = async (text) => {
  const cacheKey = text.substring(0, 100);
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey);
  }
  
  if (process.env.USE_LOCAL_EMBEDDINGS === 'true') {
    const localEmbedding = await generateLocalEmbedding(text);
    if (localEmbedding) {
      embeddingCache.set(cacheKey, localEmbedding);
      return localEmbedding;
    }
  }
  
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  try {
    const response = await openai.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      input: text
    });
    const embedding = response.data[0].embedding;
    embeddingCache.set(cacheKey, embedding);
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    
    const localEmbedding = await generateLocalEmbedding(text);
    if (localEmbedding) {
      embeddingCache.set(cacheKey, localEmbedding);
      return localEmbedding;
    }
    return null;
  }
};

const buildBuyerText = (preference) => {
  let text = '';
  
  if (preference.propertyType) text += `${preference.propertyType} `;
  if (preference.bedrooms) text += `${preference.bedrooms} bedrooms `;
  if (preference.bathrooms) text += `${preference.bathrooms} bathrooms `;
  if (preference.preferredLocations?.length) text += `in ${preference.preferredLocations.join(', ')} `;
  if (preference.parkingRequired) text += 'with parking space ';
  if (preference.balconyRequired) text += 'with balcony ';
  if (preference.furnishedRequired) text += 'furnished ';
  if (preference.floorPreference) text += `${preference.floorPreference} floor `;
  if (preference.viewType) text += `with ${preference.viewType} view `;
  if (preference.additionalFeatures?.length) text += `${preference.additionalFeatures.join(', ')} `;
  if (preference.description) text += preference.description;
  
  return expandQuery(text.trim());
};

exports.getAllBuyerPreferences = async (req, res) => {
  try {
    const preferences = await BuyerPreference.findAll({
      include: [
        { model: User, as: 'agent', attributes: ['id', 'name', 'email'] },
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'email', 'phone', 'status'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json(preferences);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching buyer preferences', error: error.message });
  }
};

exports.getAvailableLeads = async (req, res) => {
  try {
    const leads = await Lead.findAll({
      attributes: ['id', 'name', 'email', 'phone', 'status', 'budget', 'propertyPreferences', 'preferredAreas'],
      where: {
        status: { [require('sequelize').Op.in]: ['New Lead', 'Contacted', 'Visit Scheduled', 'Negotiation'] }
      },
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leads', error: error.message });
  }
};

exports.getBuyerPreferenceById = async (req, res) => {
  try {
    const preference = await BuyerPreference.findByPk(req.params.id, {
      include: [
        { model: User, as: 'agent', attributes: ['id', 'name', 'email'] },
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'email', 'phone', 'status'] }
      ]
    });
    if (!preference) return res.status(404).json({ message: 'Buyer preference not found' });
    res.status(200).json(preference);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching buyer preference', error: error.message });
  }
};

exports.createBuyerPreference = async (req, res) => {
  try {
    const { leadId, createNewLead, newLeadData, ...preferenceData } = req.body;
    
    let clientId = leadId;
    
    if (createNewLead && newLeadData) {
      const newLead = await Lead.create({
        name: newLeadData.name,
        email: newLeadData.email,
        phone: newLeadData.phone,
        budget: newLeadData.budget,
        propertyPreferences: newLeadData.propertyPreferences,
        preferredAreas: newLeadData.preferredAreas,
        status: 'New Lead',
        source: 'Property Matcher',
        agentId: req.user.id
      });
      clientId = newLead.id;
    }
    
    const preference = await BuyerPreference.create({
      ...preferenceData,
      clientId,
      agentId: req.user.id
    });
    
    const preferenceWithLead = await BuyerPreference.findByPk(preference.id, {
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'email', 'phone', 'status'] }
      ]
    });
    
    res.status(201).json(preferenceWithLead);
  } catch (error) {
    res.status(500).json({ message: 'Error creating buyer preference', error: error.message });
  }
};

exports.updateBuyerPreference = async (req, res) => {
  try {
    const preference = await BuyerPreference.findByPk(req.params.id);
    if (!preference) return res.status(404).json({ message: 'Buyer preference not found' });
    
    const { leadId, createNewLead, newLeadData, ...updateData } = req.body;
    
    if (leadId !== undefined || createNewLead) {
      if (createNewLead && newLeadData) {
        const newLead = await Lead.create({
          name: newLeadData.name,
          email: newLeadData.email,
          phone: newLeadData.phone,
          budget: newLeadData.budget,
          propertyPreferences: newLeadData.propertyPreferences,
          preferredAreas: newLeadData.preferredAreas,
          status: 'New Lead',
          source: 'Property Matcher',
          agentId: req.user.id
        });
        updateData.clientId = newLead.id;
      } else {
        updateData.clientId = leadId || null;
      }
    }
    
    await preference.update(updateData);
    
    const updatedPreference = await BuyerPreference.findByPk(preference.id, {
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'email', 'phone', 'status'] }
      ]
    });
    
    res.status(200).json(updatedPreference);
  } catch (error) {
    res.status(500).json({ message: 'Error updating buyer preference', error: error.message });
  }
};

exports.deleteBuyerPreference = async (req, res) => {
  try {
    const preference = await BuyerPreference.findByPk(req.params.id);
    if (!preference) return res.status(404).json({ message: 'Buyer preference not found' });
    
    await preference.destroy();
    res.status(200).json({ message: 'Buyer preference deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting buyer preference', error: error.message });
  }
};

exports.matchPropertiesToBuyer = async (req, res) => {
  try {
    const { id } = req.params;
    const preference = await BuyerPreference.findByPk(id);
    
    if (!preference) {
      return res.status(404).json({ message: 'Buyer preference not found' });
    }

    const { Op } = require('sequelize');
    let whereClause = { status: 'Available' };

    if (preference.budgetMin || preference.budgetMax) {
      whereClause.price = {};
      if (preference.budgetMin) whereClause.price[Op.gte] = preference.budgetMin;
      if (preference.budgetMax) whereClause.price[Op.lte] = preference.budgetMax;
    }

    if (preference.propertyType) {
      whereClause.type = preference.propertyType;
    }

    if (preference.bedrooms) {
      whereClause.bedrooms = { [Op.gte]: preference.bedrooms };
    }

    if (preference.bathrooms) {
      whereClause.bathrooms = { [Op.gte]: preference.bathrooms };
    }

    if (preference.minArea || preference.maxArea) {
      whereClause.area = {};
      if (preference.minArea) whereClause.area[Op.gte] = preference.minArea;
      if (preference.maxArea) whereClause.area[Op.lte] = preference.maxArea;
    }

    if (preference.preferredLocations?.length > 0) {
      whereClause.city = { [Op.in]: preference.preferredLocations };
    }

    if (preference.parkingRequired) {
      whereClause.parkingSpaces = { [Op.gte]: 1 };
    }

    let properties = await Property.findAll({ where: whereClause });

    const buyerText = buildBuyerText(preference);
    const buyerEmbedding = await generateEmbedding(buyerText);

    const scoredProperties = await Promise.all(properties.map(async (property) => {
      let aiSimilarity = 0;
      let embeddingMatch = false;

      if (buyerEmbedding) {
        const propertyEmbedding = await PropertyEmbedding.findOne({
          where: { propertyId: property.id }
        });

        if (propertyEmbedding?.embedding) {
          aiSimilarity = cosineSimilarity(buyerEmbedding, propertyEmbedding.embedding);
          embeddingMatch = true;
        } else {
          const propertyText = buildPropertyText(property);
          const propEmbedding = await generateEmbedding(propertyText);
          if (propEmbedding) {
            aiSimilarity = cosineSimilarity(buyerEmbedding, propEmbedding);
            embeddingMatch = true;
          }
        }
      }

      let priceScore = 0;
      let locationScore = 0;
      let featureScore = 0;
      const matchReasons = [];

      if (preference.budgetMin || preference.budgetMax) {
        const minBudget = preference.budgetMin || 0;
        const maxBudget = preference.budgetMax || Number.MAX_SAFE_INTEGER;
        const midBudget = (minBudget + maxBudget) / 2;
        
        if (Number(property.price) >= minBudget && Number(property.price) <= maxBudget) {
          priceScore = 1;
          matchReasons.push('Within budget');
        } else {
          const priceDiff = Math.abs(Number(property.price) - midBudget) / midBudget;
          priceScore = Math.max(0, 1 - priceDiff);
        }
      } else {
        priceScore = 1;
      }

      if (preference.preferredLocations?.length > 0) {
        const cityMatch = preference.preferredLocations.some(loc => 
          property.city?.toLowerCase().includes(loc.toLowerCase()) ||
          loc.toLowerCase().includes(property.city?.toLowerCase())
        );
        if (cityMatch) {
          locationScore = 1;
          matchReasons.push(`Located in ${property.city}`);
        }
      } else {
        locationScore = 1;
      }

      const propertyFeatures = Array.isArray(property.features) 
        ? property.features.map(f => f.toLowerCase()) 
        : [];
      const requiredFeatures = [];

      if (preference.parkingRequired) {
        requiredFeatures.push('parking');
      }
      if (preference.balconyRequired) {
        requiredFeatures.push('balcony');
      }
      if (preference.furnishedRequired) {
        requiredFeatures.push('furnished');
      }
      if (preference.additionalFeatures?.length) {
        requiredFeatures.push(...preference.additionalFeatures.map(f => f.toLowerCase()));
      }

      let matchedFeatures = 0;
      requiredFeatures.forEach(feature => {
        if (propertyFeatures.some(pf => pf.includes(feature) || feature.includes(pf))) {
          matchedFeatures++;
        }
      });

      if (requiredFeatures.length > 0) {
        featureScore = matchedFeatures / requiredFeatures.length;
        requiredFeatures.forEach(feature => {
          if (propertyFeatures.some(pf => pf.includes(feature) || feature.includes(pf))) {
            const niceName = feature.charAt(0).toUpperCase() + feature.slice(1);
            if (!matchReasons.includes(niceName)) {
              matchReasons.push(niceName);
            }
          }
        });
      } else {
        featureScore = 1;
      }

      const weights = {
        ai: 0.4,
        price: 0.3,
        location: 0.2,
        features: 0.1
      };

      const adjustedAiScore = embeddingMatch ? aiSimilarity : 0.5;

      const totalScore = (
        weights.ai * adjustedAiScore +
        weights.price * priceScore +
        weights.location * locationScore +
        weights.features * featureScore
      );

      return {
        property: {
          id: property.id,
          title: property.title,
          description: property.description,
          price: property.price,
          type: property.type,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          area: property.area,
          city: property.city,
          address: property.address,
          features: property.features,
          photos: property.photos,
          status: property.status
        },
        scores: {
          ai: embeddingMatch ? aiSimilarity : null,
          price: priceScore,
          location: locationScore,
          features: featureScore,
          total: totalScore
        },
        matchReasons,
        embeddingMatched: embeddingMatch
      };
    }));

    scoredProperties.sort((a, b) => b.scores.total - a.scores.total);

    const topMatches = scoredProperties.slice(0, 20);

    await preference.update({
      matchCount: topMatches.length,
      lastMatchedAt: new Date()
    });

    let aiExplanation = '';
    if (process.env.OPENAI_API_KEY && topMatches.length > 0) {
      try {
        const top3 = topMatches.slice(0, 3).map(m => 
          `${m.property.title} - $${m.property.price} - ${m.property.city} - ${m.property.bedrooms} bed`
        ).join('\n');

        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{
            role: 'system',
            content: 'You are a real estate AI assistant. Explain why properties match buyer requirements in a concise, helpful way.'
          }, {
            role: 'user',
            content: `Buyer Requirements:
- Budget: ${preference.budgetMin ? '$' + preference.budgetMin : 'Any'} - ${preference.budgetMax ? '$' + preference.budgetMax : 'Any'}
- Type: ${preference.propertyType || 'Any'}
- Bedrooms: ${preference.bedrooms || 'Any'}
- Locations: ${preference.preferredLocations?.join(', ') || 'Any'}
- Description: ${preference.description || 'None'}
- Features: ${preference.parkingRequired ? 'Parking ' : ''}${preference.balconyRequired ? 'Balcony ' : ''}${preference.furnishedRequired ? 'Furnished ' : ''}

Top Matches:
${top3}

Provide a brief explanation of why these properties are good matches.`
          }],
          max_tokens: 300
        });
        aiExplanation = completion.choices[0]?.message?.content || '';
      } catch (aiError) {
        console.log('AI explanation unavailable:', aiError.message);
      }
    }

    res.status(200).json({
      preference: {
        id: preference.id,
        clientId: preference.clientId,
        clientName: preference.clientName,
        budgetMin: preference.budgetMin,
        budgetMax: preference.budgetMax,
        propertyType: preference.propertyType,
        bedrooms: preference.bedrooms,
        description: preference.description,
        lead: preference.lead
      },
      matches: topMatches,
      totalFound: properties.length,
      aiExplanation
    });
  } catch (error) {
    res.status(500).json({ message: 'Error matching properties', error: error.message });
  }
};

exports.naturalLanguageSearch = async (req, res) => {
  try {
    const { query, filters } = req.body;

    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const expandedQuery = expandQuery(query);
    const extractedFeatures = extractFeaturesFromQuery(query);
    const priceRange = extractPriceRange(query);
    const bedrooms = extractBedrooms(query);
    const bathrooms = extractBathrooms(query);

    const semanticQuery = `${expandedQuery} ${extractedFeatures.join(' ')}`.trim();
    const buyerEmbedding = await generateEmbedding(semanticQuery);

    let whereClause = { status: 'Available' };

    if (filters || priceRange || bedrooms || bathrooms) {
      const { Op } = require('sequelize');
      whereClause = { status: 'Available' };
      
      if (priceRange?.max) {
        whereClause.price = { [Op.lte]: priceRange.max };
      }
      if (priceRange?.min) {
        whereClause.price = whereClause.price || {};
        whereClause.price[Op.gte] = priceRange.min;
      }
      if (filters?.budgetMax) {
        whereClause.price = whereClause.price || {};
        whereClause.price[Op.lte] = filters.budgetMax;
      }
      if (filters?.propertyType) {
        whereClause.type = filters.propertyType;
      }
      if (bedrooms || filters?.bedrooms) {
        whereClause.bedrooms = { [Op.gte]: bedrooms || filters.bedrooms };
      }
      if (bathrooms) {
        whereClause.bathrooms = { [Op.gte]: bathrooms };
      }
      if (filters?.city) {
        whereClause.city = { [Op.like]: `%${filters.city}%` };
      }
    }

    const properties = await Property.findAll({ where: whereClause });

    let results;
    
    if (buyerEmbedding) {
      const scored = await Promise.all(properties.map(async (property) => {
        let similarity = 0;
        let propertyEmbedding = null;
        
        const storedEmbedding = await PropertyEmbedding.findOne({
          where: { propertyId: property.id }
        });

        if (storedEmbedding?.embedding) {
          propertyEmbedding = storedEmbedding.embedding;
        } else {
          const propertyText = buildPropertyText(property);
          propertyEmbedding = await generateEmbedding(propertyText);
        }

        if (propertyEmbedding) {
          similarity = cosineSimilarity(buyerEmbedding, propertyEmbedding);
        }

        const matchedFeatures = extractedFeatures.filter(f => 
          Array.isArray(property.features) && 
          property.features.some(pf => pf.toLowerCase().includes(f))
        );

        return {
          property,
          similarity,
          matchedFeatures,
          featureMatchScore: extractedFeatures.length > 0 
            ? matchedFeatures.length / extractedFeatures.length 
            : 1
        };
      }));

      scored.sort((a, b) => {
        const scoreA = a.similarity * 0.7 + a.featureMatchScore * 0.3;
        const scoreB = b.similarity * 0.7 + b.featureMatchScore * 0.3;
        return scoreB - scoreA;
      });
      
      results = scored.slice(0, 20);
    } else {
      results = properties.slice(0, 20).map(property => ({
        property,
        similarity: 0,
        matchedFeatures: [],
        featureMatchScore: 0
      }));
    }

    res.status(200).json({
      query,
      expandedQuery,
      parsedFilters: {
        priceRange,
        bedrooms,
        bathrooms,
        features: extractedFeatures
      },
      filters: filters || {},
      results,
      totalFound: properties.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error in natural language search', error: error.message });
  }
};

exports.generatePropertyEmbeddings = async (req, res) => {
  try {
    const { propertyIds, model } = req.body;

    let properties;
    if (propertyIds?.length > 0) {
      properties = await Property.findAll({
        where: { id: { [require('sequelize').Op.in]: propertyIds } }
      });
    } else {
      properties = await Property.findAll({ where: { status: 'Available' } });
    }

    const useLocal = model === 'local' || process.env.USE_LOCAL_EMBEDDINGS === 'true';
    const embeddingModel = useLocal ? 'all-MiniLM-L6-v2' : (process.env.EMBEDDING_MODEL || 'text-embedding-3-small');
    
    const results = [];

    for (const property of properties) {
      const textContent = buildPropertyText(property);
      const embedding = await generateEmbedding(textContent);

      if (embedding) {
        await PropertyEmbedding.upsert({
          propertyId: property.id,
          embedding,
          textContent,
          embeddingModel,
          dimensions: embedding.length
        });

        results.push({
          propertyId: property.id,
          title: property.title,
          status: 'embedded',
          model: embeddingModel
        });
      } else {
        results.push({
          propertyId: property.id,
          title: property.title,
          status: 'failed',
          message: 'Could not generate embedding'
        });
      }
    }

    res.status(200).json({
      processed: results.length,
      model: embeddingModel,
      results
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating embeddings', error: error.message });
  }
};

exports.explainMatch = async (req, res) => {
  try {
    const { preferenceId, propertyId } = req.body;

    if (!preferenceId || !propertyId) {
      return res.status(400).json({ message: 'preferenceId and propertyId are required' });
    }

    const preference = await BuyerPreference.findByPk(preferenceId);
    const property = await Property.findByPk(propertyId);

    if (!preference || !property) {
      return res.status(404).json({ message: 'Preference or property not found' });
    }

    let explanation = '';
    if (process.env.OPENAI_API_KEY) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{
            role: 'system',
            content: 'You are a real estate AI assistant. Explain why a property matches buyer requirements in 2-3 sentences.'
          }, {
            role: 'user',
            content: `Buyer Requirements:
${preference.description || 'See details'}
- Budget: ${preference.budgetMin ? '$' + preference.budgetMin : 'Any'} - ${preference.budgetMax ? '$' + preference.budgetMax : 'Any'}
- Type: ${preference.propertyType || 'Any'}
- Bedrooms: ${preference.bedrooms || 'Any'}
- Locations: ${preference.preferredLocations?.join(', ') || 'Any'}

Property:
${property.title}
${property.description}
Price: $${property.price}
Location: ${property.city}, ${property.address}
Features: ${Array.isArray(property.features) ? property.features.join(', ') : 'None'}

Explain why this property is a good match.`
          }],
          max_tokens: 150
        });
        explanation = completion.choices[0]?.message?.content || '';
      } catch (aiError) {
        explanation = 'AI explanation unavailable';
      }
    } else {
      explanation = 'OpenAI API key not configured';
    }

    res.status(200).json({ explanation });
  } catch (error) {
    res.status(500).json({ message: 'Error explaining match', error: error.message });
  }
};

exports.getEmbeddingModels = async (req, res) => {
  const models = [
    { id: 'openai-ada-002', name: 'OpenAI Ada 002', type: 'cloud', dimensions: 1536 },
    { id: 'openai-3-small', name: 'OpenAI 3 Small', type: 'cloud', dimensions: 1536 },
    { id: 'openai-3-large', name: 'OpenAI 3 Large', type: 'cloud', dimensions: 3072 },
    { id: 'all-MiniLM-L6-v2', name: 'All-MiniLM-L6-v2', type: 'local', dimensions: 384 },
    { id: 'bge-small', name: 'BGE Small', type: 'local', dimensions: 384 }
  ];
  
  const hasLocal = await initLocalEmbedder().then(() => true).catch(() => false);
  
  res.status(200).json({
    models,
    activeModel: process.env.USE_LOCAL_EMBEDDINGS === 'true' ? 'all-MiniLM-L6-v2' : 'openai-3-small',
    localEmbedderAvailable: hasLocal
  });
};

exports.clearEmbeddingCache = async (req, res) => {
  embeddingCache.clear();
  res.status(200).json({ message: 'Embedding cache cleared', cacheSize: 0 });
};
