const OpenAI = require('openai');
const { Property } = require('../models/associations');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.generateMarketingContent = async (req, res) => {
  try {
    const { propertyId, contentType } = req.body;
    
    if (!propertyId || !contentType) {
      return res.status(400).json({ message: 'Property ID and content type are required' });
    }

    const property = await Property.findByPk(propertyId);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    let prompt = '';
    const propertyDetails = `
      Title: ${property.title}
      Description: ${property.description}
      Price: $${property.price}
      Type: ${property.type}
      Bedrooms: ${property.bedrooms}
      Bathrooms: ${property.bathrooms}
      Area: ${property.area} sqft
      Address: ${property.address}, ${property.city}, ${property.country}
    `;

    switch (contentType) {
      case 'description':
        prompt = `Write a compelling, luxury real estate listing description for the following property:\n${propertyDetails}\nFocus on emotional appeal and unique selling points.`;
        break;
      case 'social_post':
        prompt = `Create a punchy social media post (for Instagram/Facebook) for this property:\n${propertyDetails}\nInclude emojis and call to action. Keep it under 200 words.`;
        break;
      case 'ads_copy':
        prompt = `Write 3 different variations of Facebook/Google ad copy for this property:\n${propertyDetails}\nFocus on high conversion and urgency.`;
        break;
      case 'captions_hashtags':
        prompt = `Generate 5 creative image captions and 15 relevant real estate hashtags for this property:\n${propertyDetails}`;
        break;
      default:
        return res.status(400).json({ message: 'Invalid content type' });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: "You are a professional real estate marketing expert." },
        { role: "user", content: prompt }
      ],
      max_completion_tokens: 1000,
    });

    const content = response.choices[0].message.content;
    res.status(200).json({ content });
  } catch (error) {
    console.error('OpenAI Error:', error);
    res.status(500).json({ message: 'Error generating content', error: error.message });
  }
};
