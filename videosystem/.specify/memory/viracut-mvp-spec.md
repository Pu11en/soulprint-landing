# ViraCut MVP Product Specification

## Table of Contents
1. [Product Vision](#product-vision)
2. [Target Users](#target-users)
3. [Core Architecture](#core-architecture)
4. [User Journey](#user-journey)
   - [Landing & Project Creation](#landing--project-creation)
   - [Node-Based Video Creation Workspace](#node-based-video-creation-workspace)
   - [Video Assembly & Export](#video-assembly--export)
5. [Technical Requirements](#technical-requirements)
6. [Data Models](#data-models)
7. [Success Metrics](#success-metrics)
8. [MVP Exclusions](#mvp-exclusions)

---

## Product Vision

ViraCut is a lightning-fast, mobile-first SaaS platform for creating professional short-form commercial videos through a node-based visual editor. The platform enables users to quickly assemble compelling video content for social media marketing without requiring technical video editing skills.

### Key Value Propositions
- **Speed**: Create professional videos in minutes, not hours
- **Simplicity**: Node-based interface eliminates complex timeline editing
- **Mobile-First**: Optimized for touch interfaces and mobile workflows
- **Professional Quality**: Commercial-grade templates and effects
- **Accessibility**: No technical expertise required

---

## Target Users

### Primary Users
1. **Social Media Managers**
   - Need to create daily content for multiple platforms
   - Work with tight deadlines and limited resources
   - Require brand consistency across campaigns

2. **Small Business Owners**
   - Limited marketing budgets and time
   - Need professional content without hiring agencies
   - Often work primarily from mobile devices

3. **Content Creators**
   - Produce regular video content for platforms
   - Need efficient workflows for high-volume creation
   - Value customization and creative control

4. **Marketing Agencies**
   - Manage multiple client campaigns simultaneously
   - Need scalable solutions for rapid content production
   - Require collaboration capabilities (future enhancement)

---

## Core Architecture

### Frontend
- **Framework**: React.js with TypeScript
- **Visual Editor**: React Flow for node-based interface
- **Mobile Optimization**: PWA with touch-friendly interfaces
- **State Management**: Redux Toolkit for predictable state updates
- **Styling**: Tailwind CSS for responsive design

### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (MVP: Simple email/password)
- **Storage**: Supabase Storage for assets and exports
- **API**: RESTful endpoints with Supabase functions

### Video Processing
- **SDK**: Omniclip SDK for video assembly and processing
- **Format Support**: MP4, WebM for optimal web delivery
- **Resolution**: Adaptive (720p, 1080p based on export settings)

### Infrastructure
- **Hosting**: Vercel for frontend, Supabase for backend
- **CDN**: Integrated with Supabase Storage for global asset delivery
- **Monitoring**: Basic error tracking and performance metrics

---

## User Journey

### Landing & Project Creation

#### Landing Page
- **Hero Section**: Clear value proposition with demo video
- **Key Features**: Visual showcase of node-based editing
- **Pricing**: Simple tiered structure (Free, Pro, Enterprise)
- **Call-to-Action**: "Create Your First Video" prominent button

#### Project Creation Flow
1. **Authentication**: Simple email/password login
2. **Project Initiation**: 
   - Project name input
   - Campaign type selection:
     - Product Launch
     - Social Media Ad
     - Brand Awareness
     - Event Promotion
     - Educational Content
3. **Template Selection**: Pre-built templates based on campaign type
4. **Basic Settings**:
   - Video aspect ratio (9:16, 16:9, 1:1)
   - Target duration (15s, 30s, 60s)
   - Brand colors/logo upload

### Node-Based Video Creation Workspace

#### Workspace Layout
- **Canvas Area**: Central node editor with React Flow
- **Node Palette**: Left sidebar with available node types
- **Properties Panel**: Right sidebar for node configuration
- **Preview Panel**: Bottom panel with real-time video preview
- **Toolbar**: Top bar with common actions (save, export, undo/redo)

#### Core Node Types

1. **Video Input Node**
   - Upload video files or select from library
   - Trim and set in/out points
   - Basic adjustments (brightness, contrast)

2. **Image Input Node**
   - Upload images or select from library
   - Duration and animation settings
   - Position and scale controls

3. **Text Node**
   - Rich text editing with fonts and styles
   - Animation presets (fade, slide, typewriter)
   - Position and timing controls

4. **Audio Node**
   - Background music selection
   - Volume and fade controls
   - Audio trimming capabilities

5. **Effect Node**
   - Transitions (fade, slide, zoom)
   - Filters (vintage, modern, cinematic)
   - Overlay effects (gradients, patterns)

6. **Shape Node**
   - Basic shapes (rectangles, circles, lines)
   - Custom colors and borders
   - Animation options

7. **Logo/Brand Node**
   - Logo upload and positioning
   - Brand color integration
   - Opacity and size controls

8. **Timing Node**
   - Global timing controls
   - Synchronization markers
   - Duration settings for connected nodes

9. **Export Node**
   - Output format selection
   - Quality settings
   - Destination options

10. **Comment Node**
    - Documentation within the workspace
    - Notes for future reference
    - Collaboration hints (future feature)

#### Node Interactions
- **Drag & Drop**: Intuitive node placement and connection
- **Visual Connections**: Clear flow lines between nodes
- **Context Menus**: Right-click options for quick actions
- **Keyboard Shortcuts**: Power user efficiency (Ctrl+Z, Ctrl+S, etc.)

### Video Assembly & Export

#### Real-time Preview
- **Live Updates**: Immediate visual feedback as nodes are modified
- **Playback Controls**: Play, pause, scrub through timeline
- **Quality Settings**: Preview quality vs. performance balance

#### Export Process
1. **Validation**: Check for required nodes and connections
2. **Processing**: Omniclip SDK assembles final video
3. **Progress Tracking**: Visual progress bar with status updates
4. **Completion Options**:
   - Download to device
   - Share to social platforms
   - Save to project library
   - Generate shareable link

#### Export Settings
- **Format**: MP4 (H.264), WebM
- **Resolution**: 720p, 1080p, 4K (future)
- **Quality**: High, Medium, Low (file size optimization)
- **Frame Rate**: 24fps, 30fps, 60fps
- **Audio**: AAC, stereo/mono options

---

## Technical Requirements

### Performance Targets
- **Canvas Operations**: Under 16ms per frame (60fps)
- **Initial Load**: Under 2 seconds on 3G connection
- **Node Operations**: Sub-100ms response time
- **Export Processing**: Real-time progress updates
- **Memory Usage**: Under 500MB on mobile devices

### Responsive Design Breakpoints
- **Mobile**: 320px - 768px (primary focus)
- **Tablet**: 768px - 1024px (secondary)
- **Desktop**: 1024px+ (enhanced experience)

#### Mobile Optimizations
- **Touch Targets**: Minimum 44px for interactive elements
- **Gesture Support**: Pinch-to-zoom, swipe navigation
- **Adaptive UI**: Contextual panels and toolbars
- **Offline Capabilities**: Basic functionality with PWA

### Error Handling Requirements
- **Graceful Degradation**: Fallbacks for unsupported features
- **User Feedback**: Clear error messages with actionable steps
- **Recovery Options**: Auto-save and recovery mechanisms
- **Logging**: Comprehensive error tracking for debugging

### Data Validation with Joi Schemas
```javascript
// Example validation schemas
const projectSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  campaignType: Joi.string().valid('product-launch', 'social-ad', 'brand-awareness').required(),
  aspectRatio: Joi.string().valid('9:16', '16:9', '1:1').required(),
  duration: Joi.number().valid(15, 30, 60).required(),
  brandColors: Joi.array().items(Joi.string().pattern(/^#[0-9A-F]{6}$/i)).max(5)
});

const nodeSchema = Joi.object({
  id: Joi.string().uuid().required(),
  type: Joi.string().valid('video', 'image', 'text', 'audio', 'effect', 'shape', 'logo', 'timing', 'export', 'comment').required(),
  position: Joi.object({
    x: Joi.number().required(),
    y: Joi.number().required()
  }).required(),
  data: Joi.object().required()
});
```

### Accessibility (WCAG 2.1 AA)
- **Keyboard Navigation**: Full keyboard access to all features
- **Screen Reader Support**: ARIA labels and descriptions
- **Color Contrast**: Minimum 4.5:1 for text, 3:1 for UI elements
- **Focus Management**: Visible focus indicators and logical tab order
- **Alternative Text**: Descriptive alt text for all visual content

### Browser Support Requirements
- **Modern Browsers**: Latest versions of Chrome, Firefox, Safari, Edge
- **Mobile Browsers**: iOS Safari 14+, Chrome Mobile 90+
- **Fallback Support**: Basic functionality on older browsers
- **Progressive Enhancement**: Enhanced features on capable browsers

---

## Data Models

### Project Model
```javascript
{
  id: string (uuid),
  name: string,
  campaignType: enum,
  aspectRatio: enum,
  targetDuration: number,
  brandColors: array,
  brandLogo: string (url),
  nodes: array of node objects,
  connections: array of connection objects,
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: string (user_id),
  status: enum (draft, processing, completed, error)
}
```

### Node Model
```javascript
{
  id: string (uuid),
  type: enum,
  position: { x: number, y: number },
  data: {
    // Type-specific properties
    videoInput: { source: string, trimStart: number, trimEnd: number },
    textInput: { content: string, font: string, color: string, animation: string },
    // ... other node types
  },
  config: {
    width: number,
    height: number,
    style: object
  }
}
```

### Asset Model
```javascript
{
  id: string (uuid),
  projectId: string,
  type: enum (video, image, audio, logo),
  name: string,
  url: string,
  size: number,
  metadata: {
    duration: number,
    dimensions: { width: number, height: number },
    format: string
  },
  uploadedAt: timestamp
}
```

### Export Model
```javascript
{
  id: string (uuid),
  projectId: string,
  settings: {
    format: enum,
    resolution: enum,
    quality: enum,
    frameRate: number
  },
  status: enum (pending, processing, completed, failed),
  url: string,
  size: number,
  createdAt: timestamp,
  completedAt: timestamp
}
```

---

## Success Metrics

### User Engagement
- **Daily Active Users**: Target 1,000 DAU within 3 months
- **Session Duration**: Average 15+ minutes per session
- **Project Completion Rate**: 70% of started projects completed
- **Return User Rate**: 40% of users return within 7 days

### Performance Metrics
- **Load Time**: 95% of pages load under 2 seconds
- **Export Success Rate**: 98% successful exports
- **Error Rate**: Less than 2% of sessions encounter errors
- **Mobile Performance**: 80+ Lighthouse score on mobile

### Business Metrics
- **Conversion Rate**: 5% free to paid conversion
- **Customer Acquisition Cost**: Under $50 per customer
- **Monthly Recurring Revenue**: $10,000 within 6 months
- **User Satisfaction**: 4.5+ star rating

### Technical Metrics
- **Uptime**: 99.9% availability
- **API Response Time**: Under 200ms average
- **Database Performance**: Under 100ms query time
- **Storage Efficiency**: 90% compression ratio for assets

---

## MVP Exclusions

### AI Features
- Automated video generation
- Smart content recommendations
- Voice-to-text transcription
- Automated caption generation

### Advanced Authentication
- Social media login integration
- SSO for enterprise customers
- Multi-factor authentication
- Advanced user management

### Collaboration Features
- Real-time collaborative editing
- Team workspaces
- Comment and review system
- Approval workflows

### Advanced Analytics
- Detailed user behavior tracking
- A/B testing framework
- Performance analytics dashboard
- Export analytics

### Enterprise Features
- White-label solutions
- API access for third-party integration
- Advanced user management
- Custom branding options

### Advanced Video Features
- 3D effects and animations
- Advanced color grading
- Multi-camera editing
- Advanced audio processing

### Platform Integrations
- Direct social media publishing
- Stock media marketplace integration
- CRM integration
- Marketing automation tools

---

## Implementation Timeline

### Phase 1: Core Platform (Weeks 1-6)
- Basic React application setup
- Supabase integration
- Node editor foundation with React Flow
- Basic node types (video, image, text)
- Simple export functionality

### Phase 2: Enhanced Features (Weeks 7-10)
- Complete node implementation
- Advanced export options
- Mobile optimization
- Basic authentication system
- Performance optimization

### Phase 3: Polish & Launch (Weeks 11-12)
- UI/UX refinements
- Testing and bug fixes
- Documentation completion
- Launch preparation
- Initial marketing materials

---

## Risk Assessment

### Technical Risks
- **Omniclip SDK Integration**: Potential API limitations or performance issues
- **Mobile Performance**: Complex node editor performance on mobile devices
- **Browser Compatibility**: Ensuring consistent experience across browsers

### Business Risks
- **Market Competition**: Established players in video editing space
- **User Adoption**: Learning curve for node-based editing concept
- **Scalability**: Handling growth in users and processing demands

### Mitigation Strategies
- **Technical**: Comprehensive testing, fallback options, performance monitoring
- **Business**: Clear differentiation, user onboarding focus, scalable architecture
- **Operational**: Regular updates, community building, responsive support

---

## Conclusion

The ViraCut MVP represents a focused approach to solving the video creation challenges faced by modern marketers and content creators. By prioritizing mobile experience, intuitive design, and rapid output, the platform aims to democratize professional video content creation.

The node-based editing approach provides a unique value proposition that differentiates ViraCut from traditional timeline editors while maintaining the flexibility needed for creative expression. The MVP scope ensures a focused launch with clear success metrics and defined growth paths for future development.

This specification serves as the foundation for development decisions, user experience design, and technical implementation throughout the MVP development process.