const { Property, Website, WebsitePage, WebsiteSection, ComponentTemplate, WebsiteProperty, User } = require('../models/associations');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const PROPERTY_COMPONENTS = {
  hero: ['hero_banner', 'hero_slider', 'hero_video'],
  gallery: ['image_gallery', 'gallery_masonry', 'gallery_grid'],
  features: ['features_list', 'property_features', 'amenities_grid'],
  description: ['description_text', 'rich_text'],
  map: ['map_location', 'google_map'],
  contact: ['contact_form', 'contact_card', 'cta_buttons'],
  recommendations: ['similar_properties', 'recommended_properties']
};

const LAYOUT_TEMPLATES = [
  {
    id: 'modern-hero',
    name: 'Modern Hero',
    type: 'property',
    sections: [
      { componentType: 'hero_banner', variant: 'fullscreen' },
      { componentType: 'image_gallery', variant: 'grid' },
      { componentType: 'property_features', variant: 'icons' },
      { componentType: 'description_text', variant: 'rich' },
      { componentType: 'google_map', variant: 'fullwidth' },
      { componentType: 'contact_form', variant: 'boxed' }
    ]
  },
  {
    id: 'elegant-slider',
    name: 'Elegant Slider',
    type: 'property',
    sections: [
      { componentType: 'hero_slider', variant: 'carousel' },
      { componentType: 'property_features', variant: 'horizontal' },
      { componentType: 'description_text', variant: 'standard' },
      { componentType: 'gallery_masonry', variant: 'masonry' },
      { componentType: 'cta_buttons', variant: 'centered' },
      { componentType: 'google_map', variant: 'boxed' }
    ]
  },
  {
    id: 'minimal-card',
    name: 'Minimal Card',
    type: 'property',
    sections: [
      { componentType: 'hero_banner', variant: 'split' },
      { componentType: 'property_features', variant: 'compact' },
      { componentType: 'image_gallery', variant: 'lightbox' },
      { componentType: 'description_text', variant: 'compact' },
      { componentType: 'contact_card', variant: 'floating' }
    ]
  }
];

const HOMEPAGE_TEMPLATES = [
  {
    id: 'luxury-showcase',
    name: 'Luxury Showcase',
    type: 'homepage',
    sections: [
      { componentType: 'hero_banner', variant: 'video' },
      { componentType: 'featured_listings', variant: 'grid' },
      { componentType: 'about_section', variant: 'split' },
      { componentType: 'testimonials', variant: 'cards' },
      { componentType: 'cta_buttons', variant: 'banner' },
      { componentType: 'contact_form', variant: 'embedded' }
    ]
  },
  {
    id: 'clean-grid',
    name: 'Clean Grid',
    type: 'homepage',
    sections: [
      { componentType: 'hero_banner', variant: 'centered' },
      { componentType: 'featured_listings', variant: 'masonry' },
      { componentType: 'services_grid', variant: '3col' },
      { componentType: 'contact_card', variant: 'section' }
    ]
  }
];

exports.getWebsites = async (req, res) => {
  try {
    const websites = await Website.findAll({
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json(websites);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching websites', error: error.message });
  }
};

exports.getWebsite = async (req, res) => {
  try {
    const website = await Website.findByPk(req.params.id, {
      include: [
        { model: WebsitePage, as: 'pages', include: [{ model: WebsiteSection, as: 'sections' }] },
        { model: Property, as: 'properties', through: { attributes: ['isFeatured', 'displayOrder'] } }
      ]
    });
    if (!website) return res.status(404).json({ message: 'Website not found' });
    res.status(200).json(website);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching website', error: error.message });
  }
};

exports.createWebsite = async (req, res) => {
  try {
    const { name, slug, description, template } = req.body;
    
    const existingSlug = await Website.findOne({ where: { slug } });
    if (existingSlug) {
      return res.status(400).json({ message: 'Slug already exists' });
    }

    const website = await Website.create({
      name,
      slug,
      description,
      status: 'draft',
      ...req.body
    });

    if (template) {
      await applyTemplateToWebsite(website.id, template);
    } else {
      await applyTemplateToWebsite(website.id, 'luxury-showcase');
    }

    res.status(201).json(website);
  } catch (error) {
    res.status(500).json({ message: 'Error creating website', error: error.message });
  }
};

exports.updateWebsite = async (req, res) => {
  try {
    const website = await Website.findByPk(req.params.id);
    if (!website) return res.status(404).json({ message: 'Website not found' });
    
    await website.update(req.body);
    res.status(200).json(website);
  } catch (error) {
    res.status(500).json({ message: 'Error updating website', error: error.message });
  }
};

exports.deleteWebsite = async (req, res) => {
  try {
    const website = await Website.findByPk(req.params.id);
    if (!website) return res.status(404).json({ message: 'Website not found' });
    
    await website.destroy();
    res.status(200).json({ message: 'Website deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting website', error: error.message });
  }
};

exports.getWebsiteBySlug = async (req, res) => {
  try {
    const website = await Website.findOne({
      where: { slug: req.params.slug, status: 'published' },
      include: [
        { 
          model: WebsitePage, 
          as: 'pages',
          where: { isPublished: true },
          required: false,
          include: [{ model: WebsiteSection, as: 'sections' }]
        },
        {
          model: Property,
          as: 'properties',
          through: { attributes: ['isFeatured', 'displayOrder'] },
          where: { status: 'Available' },
          required: false
        }
      ]
    });
    
    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }
    
    res.status(200).json(website);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching website', error: error.message });
  }
};

exports.getPages = async (req, res) => {
  try {
    const pages = await WebsitePage.findAll({
      where: { websiteId: req.params.websiteId },
      include: [{ model: WebsiteSection, as: 'sections' }],
      order: [['order', 'ASC'], ['createdAt', 'ASC']]
    });
    res.status(200).json(pages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pages', error: error.message });
  }
};

exports.getPage = async (req, res) => {
  try {
    const page = await WebsitePage.findByPk(req.params.pageId, {
      include: [{ model: WebsiteSection, as: 'sections' }]
    });
    if (!page) return res.status(404).json({ message: 'Page not found' });
    res.status(200).json(page);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching page', error: error.message });
  }
};

exports.createPage = async (req, res) => {
  try {
    const page = await WebsitePage.create({
      ...req.body,
      websiteId: req.params.websiteId
    });
    res.status(201).json(page);
  } catch (error) {
    res.status(500).json({ message: 'Error creating page', error: error.message });
  }
};

exports.updatePage = async (req, res) => {
  try {
    const page = await WebsitePage.findByPk(req.params.pageId);
    if (!page) return res.status(404).json({ message: 'Page not found' });
    
    await page.update(req.body);
    res.status(200).json(page);
  } catch (error) {
    res.status(500).json({ message: 'Error updating page', error: error.message });
  }
};

exports.deletePage = async (req, res) => {
  try {
    const page = await WebsitePage.findByPk(req.params.pageId);
    if (!page) return res.status(404).json({ message: 'Page not found' });
    
    await page.destroy();
    res.status(200).json({ message: 'Page deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting page', error: error.message });
  }
};

exports.createSection = async (req, res) => {
  try {
    const section = await WebsiteSection.create({
      ...req.body,
      pageId: req.params.pageId
    });
    res.status(201).json(section);
  } catch (error) {
    res.status(500).json({ message: 'Error creating section', error: error.message });
  }
};

exports.updateSection = async (req, res) => {
  try {
    const section = await WebsiteSection.findByPk(req.params.sectionId);
    if (!section) return res.status(404).json({ message: 'Section not found' });
    
    await section.update(req.body);
    res.status(200).json(section);
  } catch (error) {
    res.status(500).json({ message: 'Error updating section', error: error.message });
  }
};

exports.deleteSection = async (req, res) => {
  try {
    const section = await WebsiteSection.findByPk(req.params.sectionId);
    if (!section) return res.status(404).json({ message: 'Section not found' });
    
    await section.destroy();
    res.status(200).json({ message: 'Section deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting section', error: error.message });
  }
};

exports.reorderSections = async (req, res) => {
  try {
    const { sections } = req.body;
    
    for (const { id, order } of sections) {
      await WebsiteSection.update({ order }, { where: { id } });
    }
    
    res.status(200).json({ message: 'Sections reordered' });
  } catch (error) {
    res.status(500).json({ message: 'Error reordering sections', error: error.message });
  }
};

exports.getComponentTemplates = async (req, res) => {
  try {
    const { category } = req.query;
    const where = { isActive: true };
    if (category) where.category = category;
    
    const templates = await ComponentTemplate.findAll({ where });
    
    if (templates.length === 0) {
      await seedComponentTemplates();
      const freshTemplates = await ComponentTemplate.findAll({ where });
      return res.status(200).json(freshTemplates);
    }
    
    res.status(200).json(templates);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching templates', error: error.message });
  }
};

exports.createComponentTemplate = async (req, res) => {
  try {
    const template = await ComponentTemplate.create(req.body);
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ message: 'Error creating template', error: error.message });
  }
};

exports.getDataSources = async (req, res) => {
  try {
    const { type } = req.query;
    
    const dataSources = {
      properties: await Property.findAll({
        where: { status: 'Available' },
        attributes: ['id', 'title', 'price', 'city', 'type', 'bedrooms', 'bathrooms', 'area', 'photos']
      }),
      leads: [],
      custom: []
    };
    
    if (type) {
      res.status(200).json(dataSources[type] || []);
    } else {
      res.status(200).json(dataSources);
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching data sources', error: error.message });
  }
};

const applyTemplateToWebsite = async (websiteId, templateType) => {
  const homepageTemplate = HOMEPAGE_TEMPLATES.find(t => t.id === templateType) || HOMEPAGE_TEMPLATES[0];
  
  const homePage = await WebsitePage.create({
    websiteId,
    name: 'Home',
    slug: 'home',
    title: 'Welcome to Our Properties',
    isHomepage: true,
    isPublished: false,
    order: 0
  });

  for (let i = 0; i < homepageTemplate.sections.length; i++) {
    const section = homepageTemplate.sections[i];
    await WebsiteSection.create({
      pageId: homePage.id,
      componentType: section.componentType,
      designVariant: section.variant,
      order: i,
      config: {},
      content: {},
      styles: {}
    });
  }

  const listingsPage = await WebsitePage.create({
    websiteId,
    name: 'Listings',
    slug: 'listings',
    title: 'Our Properties',
    isHomepage: false,
    isPublished: false,
    order: 1
  });

  await WebsiteSection.create({
    pageId: listingsPage.id,
    componentType: 'featured_listings',
    designVariant: 'grid',
    order: 0,
    config: { source: 'website_properties', limit: 12 },
    content: {},
    styles: {}
  });

  const contactPage = await WebsitePage.create({
    websiteId,
    name: 'Contact',
    slug: 'contact',
    title: 'Contact Us',
    isHomepage: false,
    isPublished: false,
    order: 2
  });

  await WebsiteSection.create({
    pageId: contactPage.id,
    componentType: 'contact_form',
    designVariant: 'boxed',
    order: 0,
    config: {},
    content: {},
    styles: {}
  });
};

const seedComponentTemplates = async () => {
  const templates = [
    {
      name: 'Hero Banner', category: 'hero', componentType: 'hero_banner',
      variants: ['fullscreen', 'centered', 'split', 'video'], icon: 'view_carousel',
      description: 'Large banner with property image and key info',
      availableDataSources: ['property', 'website'],
      defaultConfig: { height: '80vh', overlay: true, overlayOpacity: 0.4 },
      defaultContent: { title: 'Your Dream Property', subtitle: 'Find your perfect home' }
    },
    {
      name: 'Hero Slider', category: 'hero', componentType: 'hero_slider',
      variants: ['carousel', 'fade', 'slide'], icon: 'slideshow',
      description: 'Carousel of hero images',
      availableDataSources: ['properties'],
      defaultConfig: { autoPlay: true, interval: 5000, height: '70vh' },
      defaultContent: {}
    },
    {
      name: 'Image Gallery', category: 'gallery', componentType: 'image_gallery',
      variants: ['grid', 'masonry', 'lightbox', 'carousel'], icon: 'photo_library',
      description: 'Property image gallery with multiple layouts',
      availableDataSources: ['property'],
      defaultConfig: { columns: 3, gap: 16, showThumbnails: true },
      defaultContent: {}
    },
    {
      name: 'Property Features', category: 'features', componentType: 'property_features',
      variants: ['icons', 'horizontal', 'compact', 'detailed'], icon: 'feature_search',
      description: 'Display property features and amenities',
      availableDataSources: ['property'],
      defaultConfig: { columns: 4, iconSize: 32, showLabels: true },
      defaultContent: {}
    },
    {
      name: 'Description Text', category: 'content', componentType: 'description_text',
      variants: ['standard', 'rich', 'compact', 'expandable'], icon: 'description',
      description: 'Property description with rich text',
      availableDataSources: ['property'],
      defaultConfig: { maxLength: 500, showReadMore: true },
      defaultContent: {}
    },
    {
      name: 'Google Map', category: 'location', componentType: 'google_map',
      variants: ['fullwidth', 'boxed', 'interactive'], icon: 'map',
      description: 'Google Maps location display',
      availableDataSources: ['property'],
      defaultConfig: { zoom: 15, height: 400, showMarker: true },
      defaultContent: {}
    },
    {
      name: 'Contact Form', category: 'contact', componentType: 'contact_form',
      variants: ['boxed', 'embedded', 'floating', 'modal'], icon: 'contact_mail',
      description: 'Lead capture contact form',
      availableDataSources: ['website', 'agent'],
      defaultConfig: { fields: ['name', 'email', 'phone', 'message'], submitAction: 'email' },
      defaultContent: { submitText: 'Send Message', successMessage: 'Thank you!' }
    },
    {
      name: 'CTA Buttons', category: 'contact', componentType: 'cta_buttons',
      variants: ['centered', 'banner', 'floating', 'inline'], icon: 'touch_app',
      description: 'Call to action buttons',
      availableDataSources: ['property'],
      defaultConfig: { buttons: [{ text: 'Schedule Visit', action: 'schedule' }, { text: 'Request Info', action: 'contact' }] },
      defaultContent: {}
    },
    {
      name: 'Featured Listings', category: 'listings', componentType: 'featured_listings',
      variants: ['grid', 'masonry', 'carousel', 'list'], icon: 'apartment',
      description: 'Display property listings',
      availableDataSources: ['properties', 'website_properties', 'featured'],
      defaultConfig: { columns: 3, limit: 6, showPagination: false },
      defaultContent: {}
    },
    {
      name: 'Similar Properties', category: 'listings', componentType: 'similar_properties',
      variants: ['grid', 'carousel', 'horizontal'], icon: 'recommend',
      description: 'Show similar/related properties',
      availableDataSources: ['property'],
      defaultConfig: { limit: 4, matchCriteria: ['type', 'city', 'price_range'] },
      defaultContent: {}
    },
    {
      name: 'About Section', category: 'content', componentType: 'about_section',
      variants: ['split', 'centered', 'cards'], icon: 'info',
      description: 'About company section',
      availableDataSources: ['website'],
      defaultConfig: {},
      defaultContent: { title: 'About Us', content: 'Your trusted real estate partner' }
    },
    {
      name: 'Contact Card', category: 'contact', componentType: 'contact_card',
      variants: ['section', 'floating', 'sidebar'], icon: 'contact_phone',
      description: 'Contact information card',
      availableDataSources: ['website', 'agent'],
      defaultConfig: { showEmail: true, showPhone: true, showAddress: true },
      defaultContent: {}
    }
  ];

  for (const template of templates) {
    await ComponentTemplate.upsert(template, { ignoreDuplicates: true });
  }
};

exports.seedComponentTemplates = seedComponentTemplates;

// AI Website Generation
exports.generateAWebsite = async (req, res) => {
  try {
    const { websiteId, propertyIds, template, options } = req.body;
    
    const website = await Website.findByPk(websiteId);
    if (!website) return res.status(404).json({ message: 'Website not found' });
    
    let properties = [];
    if (propertyIds?.length > 0) {
      properties = await Property.findAll({
        where: { id: { [require('sequelize').Op.in]: propertyIds } }
      });
    } else {
      properties = await Property.findAll({ where: { status: 'Available' }, limit: 10 });
    }

    const selectedTemplate = HOMEPAGE_TEMPLATES.find(t => t.id === template) || HOMEPAGE_TEMPLATES[0];
    
    let generatedContent = {};
    
    if (process.env.OPENAI_API_KEY && options?.aiContent) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{
            role: 'system',
            content: 'You are a real estate marketing expert. Generate compelling website content.'
          }, {
            role: 'user',
            content: `Generate content for a real estate website with ${properties.length} properties.
Properties: ${properties.map(p => `${p.title} - ${p.type} in ${p.city} - $${p.price}`).join(', ')}

Generate: 1. Homepage hero title and subtitle 2. About section content 3. SEO title and description`
          }],
          max_tokens: 500
        });
        generatedContent = parseAIResponse(completion.choices[0]?.message?.content || '');
      } catch (aiError) {
        console.log('AI generation skipped:', aiError.message);
      }
    }

    const homePage = await WebsitePage.findOne({ where: { websiteId, isHomepage: true } });
    if (homePage && generatedContent.homepageTitle) {
      await homePage.update({ 
        title: generatedContent.homepageTitle,
        seoTitle: generatedContent.seoTitle || generatedContent.homepageTitle,
        seoDescription: generatedContent.seoDescription
      });
    }

    const pages = [];
    
    for (const property of properties) {
      const existingPage = await WebsitePage.findOne({
        where: { websiteId, slug: `property-${property.id}` }
      });
      
      if (!existingPage) {
        const propertyPage = await WebsitePage.create({
          websiteId,
          name: property.title,
          slug: `property-${property.id}`,
          title: property.title,
          description: property.description,
          seoTitle: `${property.title} | ${property.city} Real Estate`,
          seoDescription: property.description?.substring(0, 160) || `${property.bedrooms} bedroom ${property.type} in ${property.city}`,
          isHomepage: false,
          isPublished: false,
          order: pages.length + 10
        });

        const propertyTemplate = LAYOUT_TEMPLATES.find(t => t.id === (options?.propertyTemplate || 'modern-hero')) || LAYOUT_TEMPLATES[0];
        
        for (let i = 0; i < propertyTemplate.sections.length; i++) {
          const section = propertyTemplate.sections[i];
          await WebsiteSection.create({
            pageId: propertyPage.id,
            componentType: section.componentType,
            designVariant: section.variant,
            order: i,
            dataSource: { propertyId: property.id },
            config: getDefaultComponentConfig(section.componentType),
            content: getPropertyContent(property, section.componentType),
            styles: {}
          });
        }
        
        pages.push(propertyPage);
      }
    }

    await WebsiteProperty.destroy({ where: { websiteId } });
    for (let i = 0; i < Math.min(properties.length, 6); i++) {
      await WebsiteProperty.create({
        websiteId,
        propertyId: properties[i].id,
        isFeatured: i < 3,
        displayOrder: i
      });
    }

    res.status(200).json({
      website: website.name,
      homepageUpdated: !!homePage,
      pagesCreated: pages.length,
      propertiesLinked: properties.length,
      template: selectedTemplate.name
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating website', error: error.message });
  }
};

const getDefaultComponentConfig = (componentType) => {
  const configs = {
    hero_banner: { height: '70vh', overlay: true },
    image_gallery: { columns: 3, lightbox: true },
    property_features: { columns: 4, icons: true },
    google_map: { zoom: 15, height: 400 },
    contact_form: { fields: ['name', 'email', 'phone', 'message'] },
    featured_listings: { columns: 3, limit: 6 }
  };
  return configs[componentType] || {};
};

const getPropertyContent = (property, componentType) => {
  const content = {};
  
  switch (componentType) {
    case 'hero_banner':
      content.title = property.title;
      content.subtitle = `${property.city} | ${property.type}`;
      content.price = `$${Number(property.price).toLocaleString()}`;
      content.image = property.photos?.[0] || '';
      break;
    case 'image_gallery':
      content.images = property.photos || [];
      break;
    case 'property_features':
      content.features = [
        { icon: 'bed', label: 'Bedrooms', value: property.bedrooms },
        { icon: 'bathtub', label: 'Bathrooms', value: property.bathrooms },
        { icon: 'square_foot', label: 'Area', value: `${property.area} sqm` },
        { icon: 'directions_car', label: 'Parking', value: property.parkingSpaces || 0 },
        ...(property.features || []).slice(0, 4).map(f => ({ icon: 'check', label: f, value: 'Yes' }))
      ];
      break;
    case 'description_text':
      content.text = property.description || 'No description available.';
      break;
    case 'google_map':
      content.lat = property.lat || 0;
      content.lng = property.lng || 0;
      content.address = property.address;
      content.city = property.city;
      break;
    case 'contact_form':
      content.propertyId = property.id;
      content.propertyTitle = property.title;
      break;
  }
  
  return content;
};

const parseAIResponse = (response) => {
  const lines = response.split('\n').filter(l => l.trim());
  const content = {};
  
  lines.forEach(line => {
    if (line.includes('Hero Title:') || line.includes('Title:')) {
      content.homepageTitle = line.replace(/.*Title:/i, '').trim();
    }
    if (line.includes('Subtitle:')) {
      content.homepageSubtitle = line.replace(/.*Subtitle:/i, '').trim();
    }
    if (line.includes('About:')) {
      content.aboutContent = line.replace(/.*About:/i, '').trim();
    }
    if (line.includes('SEO Title:')) {
      content.seoTitle = line.replace(/.*Title:/i, '').trim();
    }
    if (line.includes('Description:')) {
      content.seoDescription = line.replace(/.*Description:/i, '').trim();
    }
  });
  
  return content;
};

exports.getLayoutTemplates = async (req, res) => {
  res.status(200).json({
    property: LAYOUT_TEMPLATES,
    homepage: HOMEPAGE_TEMPLATES
  });
};

exports.exportWebsite = async (req, res) => {
  try {
    const { websiteId, format } = req.body;
    
    const website = await Website.findByPk(websiteId, {
      include: [
        { model: WebsitePage, as: 'pages', include: [{ model: WebsiteSection, as: 'sections' }] }
      ]
    });
    
    if (!website) return res.status(404).json({ message: 'Website not found' });
    
    const exportData = {
      website: {
        name: website.name,
        slug: website.slug,
        theme: {
          primaryColor: website.primaryColor,
          secondaryColor: website.secondaryColor,
          fontFamily: website.fontFamily
        }
      },
      pages: website.pages.map(page => ({
        name: page.name,
        slug: page.slug,
        sections: page.sections.map(s => ({
          componentType: s.componentType,
          variant: s.designVariant,
          content: s.content,
          config: s.config
        }))
      })),
      exportedAt: new Date().toISOString()
    };
    
    if (format === 'json') {
      return res.status(200).json(exportData);
    }
    
    const html = generateStaticHTML(exportData);
    
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${website.slug}.html"`);
    res.status(200).send(html);
  } catch (error) {
    res.status(500).json({ message: 'Error exporting website', error: error.message });
  }
};

const generateStaticHTML = (data) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.website.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: ${data.website.theme.fontFamily || 'Urbanist'}, sans-serif; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .property-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .property-card { border: 1px solid #eee; border-radius: 8px; overflow: hidden; }
    .property-card img { width: 100%; height: 200px; object-fit: cover; }
    .property-info { padding: 16px; }
    .price { color: #6366f1; font-size: 24px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${data.website.name}</h1>
    <p>Exported from RealEdge</p>
  </div>
</body>
</html>`;
};

exports.linkProperties = async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { propertyIds, featuredIds } = req.body;
    
    await WebsiteProperty.destroy({ where: { websiteId } });
    
    const links = [];
    for (let i = 0; i < propertyIds.length; i++) {
      links.push({
        websiteId,
        propertyId: propertyIds[i],
        isFeatured: featuredIds?.includes(propertyIds[i]) || false,
        displayOrder: i
      });
    }
    
    await WebsiteProperty.bulkCreate(links);
    
    res.status(200).json({ message: 'Properties linked successfully', count: links.length });
  } catch (error) {
    res.status(500).json({ message: 'Error linking properties', error: error.message });
  }
};

exports.getWebsiteProperties = async (req, res) => {
  try {
    const { websiteId } = req.params;
    
    const properties = await WebsiteProperty.findAll({
      where: { websiteId },
      include: [{ 
        model: Property, 
        as: 'property',
        attributes: ['id', 'title', 'price', 'city', 'type', 'bedrooms', 'bathrooms', 'area', 'photos']
      }],
      order: [['displayOrder', 'ASC']]
    });
    
    res.status(200).json(properties);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching website properties', error: error.message });
  }
};
