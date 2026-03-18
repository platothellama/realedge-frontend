const { ComponentTemplate } = require('../models/associations');

const componentTemplates = [
  // Headers
  {
    name: 'Modern Header',
    category: 'Header',
    componentType: 'header',
    variants: ['default', 'transparent', 'minimal', 'centered'],
    defaultConfig: {
      showLogo: true,
      showNavigation: true,
      showSearch: false,
      showContactButton: true,
      sticky: true
    },
    defaultContent: {
      logo: '/assets/logo.png',
      navLinks: [
        { label: 'Home', url: '/' },
        { label: 'Properties', url: '/properties' },
        { label: 'About', url: '/about' },
        { label: 'Contact', url: '/contact' }
      ],
      ctaText: 'Get Started',
      ctaUrl: '/contact'
    },
    availableDataSources: [],
    icon: 'view_quilt'
  },
  // Hero Sections
  {
    name: 'Hero Banner',
    category: 'Hero',
    componentType: 'hero',
    variants: ['default', 'centered', 'split', 'video', 'carousel'],
    defaultConfig: {
      height: 'large',
      overlay: true,
      overlayOpacity: 0.4,
      showScrollIndicator: true
    },
    defaultContent: {
      title: 'Find Your Dream Home',
      subtitle: 'Discover the perfect property for you and your family',
      primaryButtonText: 'Browse Properties',
      primaryButtonUrl: '/properties',
      secondaryButtonText: 'Contact Us',
      secondaryButtonUrl: '/contact',
      backgroundImage: '/assets/hero-bg.jpg'
    },
    availableDataSources: [],
    icon: 'wallpaper'
  },
  {
    name: 'Property Search',
    category: 'Hero',
    componentType: 'propertySearch',
    variants: ['default', 'compact', 'expanded', 'horizontal'],
    defaultConfig: {
      showPrice: true,
      showPropertyType: true,
      showBedrooms: true,
      showLocation: true,
      showAdvancedFilters: true
    },
    defaultContent: {
      placeholder: 'Search by city, neighborhood, or ZIP...',
      searchButtonText: 'Search'
    },
    availableDataSources: [],
    icon: 'search'
  },
  // Content Sections
  {
    name: 'Feature Cards',
    category: 'Content',
    componentType: 'featureCards',
    variants: ['default', 'grid', 'list', 'icon-only'],
    defaultConfig: {
      columns: 3,
      showIcons: true,
      cardStyle: 'default'
    },
    defaultContent: {
      features: [
        { title: 'Expert Agents', description: 'Professional real estate agents ready to help', icon: 'person' },
        { title: 'Wide Selection', description: 'Thousands of properties to choose from', icon: 'home' },
        { title: 'Secure Process', description: 'Safe and secure transaction handling', icon: 'verified_user' }
      ]
    },
    availableDataSources: [],
    icon: 'widgets'
  },
  {
    name: 'About Section',
    category: 'Content',
    componentType: 'about',
    variants: ['default', 'split', 'gallery'],
    defaultConfig: {
      imagePosition: 'left',
      showStats: true
    },
    defaultContent: {
      title: 'About Our Company',
      content: 'We are a leading real estate company dedicated to helping you find your perfect property.',
      stats: [
        { value: '500+', label: 'Properties Sold' },
        { value: '10+', label: 'Years Experience' },
        { value: '100+', label: 'Happy Clients' }
      ],
      image: '/assets/about.jpg'
    },
    availableDataSources: [],
    icon: 'info'
  },
  // Property Sections
  {
    name: 'Property Grid',
    category: 'Properties',
    componentType: 'propertyGrid',
    variants: ['default', 'grid-3', 'grid-4', 'list', 'compact'],
    defaultConfig: {
      columns: 3,
      showPagination: true,
      itemsPerPage: 9,
      showFilters: true,
      showSort: true,
      cardStyle: 'default'
    },
    defaultContent: {
      title: 'Featured Properties',
      subtitle: 'Browse our latest listings'
    },
    availableDataSources: ['properties'],
    icon: 'grid_view'
  },
  {
    name: 'Property Carousel',
    category: 'Properties',
    componentType: 'propertyCarousel',
    variants: ['default', 'featured', 'compact'],
    defaultConfig: {
      showArrows: true,
      showDots: true,
      autoPlay: false,
      itemsToShow: 4
    },
    defaultContent: {
      title: 'Latest Properties'
    },
    availableDataSources: ['properties'],
    icon: 'view_carousel'
  },
  // Lead Capture
  {
    name: 'Contact Form',
    category: 'Forms',
    componentType: 'contactForm',
    variants: ['default', 'minimal', 'with-map'],
    defaultConfig: {
      showName: true,
      showEmail: true,
      showPhone: true,
      showMessage: true,
      showSubject: true,
      submitAction: 'email'
    },
    defaultContent: {
      title: 'Contact Us',
      subtitle: 'Get in touch with our team',
      submitButtonText: 'Send Message',
      successMessage: 'Thank you for your message!'
    },
    availableDataSources: [],
    icon: 'contact_mail'
  },
  {
    name: 'Newsletter Signup',
    category: 'Forms',
    componentType: 'newsletter',
    variants: ['default', 'compact', 'minimal'],
    defaultConfig: {
      showName: false,
      showPrivacyCheckbox: true
    },
    defaultContent: {
      title: 'Subscribe to Our Newsletter',
      subtitle: 'Get the latest property updates and news',
      buttonText: 'Subscribe',
      placeholder: 'Enter your email'
    },
    availableDataSources: [],
    icon: 'mark_email_read'
  },
  {
    name: 'Lead Capture Popup',
    category: 'Forms',
    componentType: 'leadCapture',
    variants: ['default', 'inline', 'floating'],
    defaultConfig: {
      trigger: 'exit-intent',
      showName: true,
      showPhone: true
    },
    defaultContent: {
      title: 'Get Exclusive Listings',
      subtitle: 'Be the first to know about new properties',
      buttonText: 'Get Started'
    },
    availableDataSources: [],
    icon: 'person_add'
  },
  // Agent Sections
  {
    name: 'Agent Team',
    category: 'Team',
    componentType: 'agentTeam',
    variants: ['default', 'grid', 'carousel'],
    defaultConfig: {
      columns: 4,
      showBio: true,
      showSocial: true,
      showContact: true
    },
    defaultContent: {
      title: 'Our Team',
      subtitle: 'Meet our experienced real estate agents'
    },
    availableDataSources: ['agents'],
    icon: 'groups'
  },
  // Testimonials
  {
    name: 'Testimonials',
    category: 'Social',
    componentType: 'testimonials',
    variants: ['default', 'carousel', 'grid', 'featured'],
    defaultConfig: {
      showAvatar: true,
      showRating: true,
      layout: 'carousel'
    },
    defaultContent: {
      testimonials: [
        { name: 'John Smith', text: 'Amazing service! Found our dream home within weeks.', rating: 5 },
        { name: 'Sarah Johnson', text: 'Professional and attentive. Highly recommended!', rating: 5 },
        { name: 'Mike Wilson', text: 'Great experience working with this team.', rating: 5 }
      ]
    },
    availableDataSources: [],
    icon: 'format_quote'
  },
  // Call to Action
  {
    name: 'Call to Action',
    category: 'CTA',
    componentType: 'cta',
    variants: ['default', 'centered', 'split', 'boxed'],
    defaultConfig: {
      style: 'default',
      showSecondaryButton: true
    },
    defaultContent: {
      title: 'Ready to Find Your Dream Home?',
      description: 'Let our experts help you find the perfect property',
      primaryButtonText: 'Browse Properties',
      primaryButtonUrl: '/properties',
      secondaryButtonText: 'Contact Us',
      secondaryButtonUrl: '/contact'
    },
    availableDataSources: [],
    icon: 'touch_app'
  },
  // Footer
  {
    name: 'Footer',
    category: 'Footer',
    componentType: 'footer',
    variants: ['default', 'minimal', 'expanded'],
    defaultConfig: {
      columns: 4,
      showSocial: true,
      showNewsletter: true,
      showCopyright: true
    },
    defaultContent: {
      companyName: 'RealEstate Co',
      description: 'Your trusted partner in real estate',
      quickLinks: [
        { label: 'Home', url: '/' },
        { label: 'Properties', url: '/properties' },
        { label: 'About', url: '/about' },
        { label: 'Contact', url: '/contact' }
      ],
      services: [
        { label: 'Buy', url: '/buy' },
        { label: 'Sell', url: '/sell' },
        { label: 'Rent', url: '/rent' },
        { label: 'Invest', url: '/invest' }
      ]
    },
    availableDataSources: [],
    icon: 'footer'
  },
  // Map
  {
    name: 'Property Map',
    category: 'Maps',
    componentType: 'propertyMap',
    variants: ['default', 'list-view', 'full-width'],
    defaultConfig: {
      provider: 'google',
      showMarkers: true,
      clusterMarkers: true,
      defaultZoom: 12
    },
    defaultContent: {
      title: 'Find Us'
    },
    availableDataSources: ['properties'],
    icon: 'map'
  },
  // Blog/News
  {
    name: 'Blog Section',
    category: 'Content',
    componentType: 'blog',
    variants: ['default', 'grid', 'list', 'featured'],
    defaultConfig: {
      showExcerpt: true,
      showDate: true,
      showAuthor: true,
      postsPerPage: 3
    },
    defaultContent: {
      title: 'Latest News',
      subtitle: 'Stay updated with real estate trends'
    },
    availableDataSources: [],
    icon: 'article'
  }
];

async function seedComponentTemplates() {
  try {
    const { ComponentTemplate } = require('../models/associations');
    
    for (const template of componentTemplates) {
      await ComponentTemplate.findOrCreate({
        where: { componentType: template.componentType, variants: template.variants },
        defaults: template
      });
    }
    
    console.log('✅ Component templates seeded');
  } catch (error) {
    console.error('❌ Error seeding component templates:', error.message);
  }
}

module.exports = seedComponentTemplates;
