# Overview

This is a full-stack web application called "Grading Pro" - an AI-powered educational grading platform that helps professors automatically grade student assignments using multiple LLM providers. The application features a React frontend with TypeScript, an Express.js backend, and PostgreSQL database integration using Drizzle ORM.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom color schemes and design tokens
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Math Rendering**: KaTeX for mathematical notation display

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints with comprehensive error handling
- **File Processing**: Multi-format document processing (PDF, DOCX, images)
- **OCR Integration**: Tesseract.js for text extraction from images and PDFs

## Data Storage
- **Database**: PostgreSQL 16 with connection pooling via Neon serverless
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Connection**: @neondatabase/serverless for WebSocket-based connections

# Key Components

## LLM Integration System
- **Multi-Provider Support**: DeepSeek (deepseek-chat, deepseek-coder), OpenAI (GPT-4o), Anthropic (Claude 3.7 Sonnet), Perplexity (Llama 3.1 Sonar models)
- **Default Provider**: DeepSeek for optimal performance and cost efficiency
- **Intelligent Chunking**: Handles extremely large documents up to 400K words with token-aware processing
- **Temperature Control**: Configurable temperature settings for consistent grading
- **Context Preservation**: Maintains assignment context across large document chunks

## Document Processing Pipeline
- **Multi-Format Support**: PDF, DOCX, images with automatic text extraction
- **Mathematical Content**: KaTeX rendering and MathPix OCR integration for mathematical notation
- **AI Detection**: GPTZero integration for detecting AI-generated content
- **Smart Parsing**: Automatic student name detection and content formatting

## Grading Engine
- **Adaptive Grading**: Multiple depth levels (short, medium, long) for different feedback needs
- **Grade Level Aware**: Customizable feedback based on academic level (K-12 through PhD)
- **Chart Generation**: Automatic performance visualization and analytics
- **Professor Feedback Loop**: Iterative improvement system based on instructor input

## Communication System
- **Email Integration**: SendGrid for automated feedback delivery
- **Real-time Chat**: AI-powered chat interface for assignment discussions
- **PDF Export**: Professional report generation for grading results

# Data Flow

1. **Assignment Creation**: Professors create assignments with prompts and grading rubrics
2. **Submission Processing**: Student submissions are uploaded and processed through document extraction pipeline
3. **AI Analysis**: Content is analyzed for AI detection and then sent to selected LLM provider
4. **Intelligent Chunking**: Large submissions are automatically chunked while preserving context
5. **Grading Generation**: AI generates grades and feedback based on assignment criteria
6. **Professor Review**: Instructors can provide feedback to refine AI grading
7. **Result Delivery**: Grades and feedback are delivered via email or exported as PDF

# External Dependencies

## AI Services
- **DeepSeek API**: DeepSeek Chat and Coder models for efficient reasoning and grading (default provider)
- **OpenAI API**: GPT-4o for advanced reasoning and grading
- **Anthropic API**: Claude 3.7 Sonnet for nuanced feedback generation
- **Perplexity API**: Llama 3.1 Sonar models for research-enhanced grading
- **GPTZero API**: AI content detection and plagiarism analysis
- **MathPix API**: Mathematical notation extraction from images

## Infrastructure Services
- **Neon Database**: Serverless PostgreSQL hosting
- **SendGrid**: Transactional email delivery
- **Replit**: Development and deployment platform

## Frontend Libraries
- **TanStack Query**: Server state management and caching
- **Radix UI**: Accessible component primitives
- **KaTeX**: Mathematical notation rendering
- **Tesseract.js**: Client-side OCR processing

# Deployment Strategy

## Development Environment
- **Platform**: Replit with Node.js 20 runtime
- **Database**: PostgreSQL 16 module with automatic provisioning
- **Port Configuration**: Application runs on port 5000 with external port 80
- **Hot Reload**: Vite development server with HMR support

## Production Build
- **Build Process**: Two-stage build (Vite for frontend, esbuild for backend)
- **Bundle Strategy**: ESM modules with external package dependencies
- **Static Assets**: Frontend built to dist/public directory
- **Server Bundle**: Backend bundled to dist/index.js

## Autoscale Deployment
- **Target**: Replit autoscale infrastructure
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`
- **Environment**: Production Node.js with optimized bundle

# Changelog

```
Changelog:
- September 17, 2025: **CRITICAL DATABASE FIX**: Fixed assignment saving to use permanent Neon database storage
  * Changed storage from MemStorage to DatabaseStorage in server/storage.ts for permanent data persistence
  * Verified user profiles exist permanently in database (12 users including jmkuczynski, randyjohnson with unlimited credits)
  * All assignments now save permanently to PostgreSQL database and persist across application restarts
  * Fixed assignment creation/saving system - assignments now properly stored with user isolation
  * Completed comprehensive inter-component communication system testing - all send buttons working perfectly
- September 16, 2025: **MAJOR UX ENHANCEMENT**: Completed comprehensive inter-component communication system for AI Text Rewriter (Humanizer)
  * Added copy button above Box C and trash can buttons above each box (A, B, C) in AI Text Rewriter
  * Implemented "Send Box C → Student Submission" functionality for seamless workflow
  * Added "Send Perfect Assignment Generator → Box A" with "To Humanizer" button in PaperImprovementBox  
  * Created "Send Chat AI responses → Student Submission OR AI Text Rewriter Box A" with dedicated buttons
  * All inter-component communication working through proper React state management
- September 16, 2025: **CRITICAL BUG FIXES**: Resolved AI Text Rewriter and authentication issues
  * Fixed AI Text Rewriter preview mode that was incorrectly copying input directly to output
  * Created generateRewritePreview() function to show proper preview with first 50 words + login prompt
  * Restored JMKUCZYNSKI testing authentication bypass with unlimited credits (999,999,999)
  * Verified complete system functionality after security fixes
- September 16, 2025: Fixed assignment save functionality to properly update existing assignments instead of creating duplicates
- September 16, 2025: Resolved Stripe checkout authentication issues by adding /api/whoami endpoint and proper user authentication flow
- September 16, 2025: Updated all LLM provider labels to ZHI branding (OpenAI→ZHI 1, Anthropic→ZHI 2, DeepSeek→ZHI 3, Perplexity→ZHI 4)
- September 16, 2025: Set ZHI 1 (OpenAI with GPT-4o) as the default LLM provider for all functions
- September 16, 2025: Enhanced error handling and debugging for payment processing system
- January 17, 2025: Enhanced keyboard navigation with comprehensive shortcuts across all input fields
  * Added Ctrl+Enter to grade submission in student text area (minimum 50 characters required)
  * Added Ctrl+Enter to move to next field in assignment prompt and grading instructions areas
  * Added Ctrl+Enter to generate perfect answer in perfect assignment generator
  * Added Enter key to submit login and register forms instantly
  * Updated all placeholder texts to show keyboard shortcuts for improved UX
  * Chat already had Enter key functionality (Enter to send, Shift+Enter for new line)
- January 17, 2025: Fixed grading system validation to accept empty instructions with automatic defaults
- January 17, 2025: Implemented unlimited credits system for usernames "JMKUCZYNSKI" and "RANDYJOHNSON" for app testing
- January 17, 2025: Updated credit display to show "∞ credits" for unlimited accounts (jmkuczynski, randyjohnson)
- January 17, 2025: Verified complete app functionality with proper grade extraction and AI detection
- January 12, 2025: Fixed complete freemium system - unregistered users get 200-word previews, registration and Stripe payment flow working
- January 12, 2025: Implemented default grading instructions so app works without user input
- January 12, 2025: Fixed API response handling to properly display JSON preview content
- January 12, 2025: Completely disabled GPTZero for unregistered users (no UI elements, no backend calls)
- January 9, 2025: Added discrete "Contact Us" link in header linking to contact@zhisystems.ai
- January 9, 2025: Activated all API keys (OpenAI, Anthropic, DeepSeek, Perplexity) for full functionality
- January 9, 2025: Optimized homework generator with DeepSeek for 5-15 second response times
- January 9, 2025: Fixed perfect answer generation to work with all LLM providers
- June 27, 2025: Fixed grading system to prioritize correctness over style (90/10 weighting)
- June 27, 2025: Updated all AI provider system prompts to grade generously for correct work
- June 27, 2025: Modified grading criteria to avoid stylistic deductions unless clarity compromised
- December 27, 2024: Added perfect-assignment-to-student-submission verification feature
- December 27, 2024: Added DeepSeek LLM provider integration with deepseek-chat and deepseek-coder models
- December 27, 2024: Set DeepSeek as default LLM provider for optimal performance
- December 27, 2024: Added chat-to-perfect-generator functionality with dedicated arrow button
- December 27, 2024: Enhanced chat interface with direct content transfer to perfect assignment generator
- June 27, 2025: Initial setup
```

# User Preferences

```
Preferred communication style: Simple, everyday language.
```