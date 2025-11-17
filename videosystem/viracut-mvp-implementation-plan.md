# ViraCut MVP Implementation Plan

## Table of Contents
1. [Introduction](#introduction)
2. [Development Environment Setup](#development-environment-setup)
3. [Phase 1: Setup Implementation Strategy](#phase-1-setup-implementation-strategy)
4. [Phase 2: Foundational Implementation Strategy](#phase-2-foundational-implementation-strategy)
5. [Phase 3-7: User Stories Implementation Strategy](#phase-3-7-user-stories-implementation-strategy)
6. [Phase 8: Polish & Cross-Cutting Concerns](#phase-8-polish--cross-cutting-concerns)
7. [AI-Assisted Development with Cursor/Copilot](#ai-assisted-development-with-cursorcopilot)
8. [Atomic Commits Best Practices](#atomic-commits-best-practices)
9. [Verification Steps for Vercel Deployment](#verification-steps-for-vercel-deployment)
10. [Technical Implementation Details](#technical-implementation-details)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Conclusion](#conclusion)

---

## Introduction

This document provides a comprehensive implementation plan for the ViraCut MVP, following the task list sequentially from Foundation → Canvas → Assets → Editor → Polish. It serves as a practical guide for developers to implement the ViraCut MVP following the verified task list from [`tasks.md`](../specs/master/tasks.md).

### Project Overview

ViraCut is a mobile-first, node-based video editing platform built with:
- **Frontend**: Next.js 15, React Flow, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Video Processing**: Omniclip SDK
- **Deployment**: Vercel (frontend) + Supabase (backend)

### Implementation Philosophy

1. **Sequential Phase Completion**: Each phase must be fully completed before moving to the next
2. **Atomic Commits**: Each task or logical group of tasks should be committed separately
3. **Incremental Testing**: Test each phase independently before proceeding
4. **Mobile-First Development**: Optimize for mobile experience throughout
5. **Performance-Driven**: Maintain performance targets throughout development

---

## Development Environment Setup

Before starting implementation, ensure your environment is properly configured:

### Prerequisites
- Node.js 18.17.0+
- npm 9.0.0+
- Git
- VS Code with recommended extensions
- Supabase account
- Vercel account
- Omniclip SDK API key

### Initial Setup Commands
```bash
# Clone repository
git clone https://github.com/your-org/viracut-mvp.git
cd viracut-mvp

# Install dependencies
npm install
cd frontend && npm install
cd ../backend && npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Setup Supabase
npm install -g supabase
supabase link --project-ref your_project_ref
supabase db push
```

---

## Phase 1: Setup Implementation Strategy

### Goal: Project initialization and basic structure

#### Task T001: Create project structure
```bash
# Create directory structure
mkdir -p frontend/{src,public,tests}
mkdir -p frontend/src/{components,pages,services,models,hooks,utils,store,types}
mkdir -p frontend/src/components/{atoms,molecules,organisms,templates}
mkdir -p frontend/tests/{unit,integration,e2e}
mkdir -p backend/{src,functions,migrations}
mkdir -p backend/src/{api,models,services,middleware,utils}
mkdir -p docs
```

#### Task T002: Initialize Next.js 15 project
```bash
# Using Cursor/Copilot prompt:
# "Create a Next.js 15 project with TypeScript, Tailwind CSS, and the following structure:
# - App Router configuration
# - TypeScript strict mode
# - Tailwind CSS with mobile-first design
# - ESLint and Prettier configuration
# - Basic layout.tsx and page.tsx files"

# Expected generated files:
# - next.config.js
# - tailwind.config.ts
# - tsconfig.json
# - app/layout.tsx
# - app/page.tsx
```

#### Task T003: Configure linting and formatting
```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "prefer-const": "error"
  }
}
```

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

#### Task T004: Setup performance monitoring
```bash
npm install @vercel/web-vitals lighthouse
```

```typescript
// lib/monitoring.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric: any) {
  // Send to your analytics endpoint
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metric),
  });
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

#### Task T005: Configure atomic design system
```typescript
// src/components/atoms/index.ts
export { Button } from './Button';
export { Input } from './Input';
export { Modal } from './Modal';

// src/components/molecules/index.ts
export { NodeCard } from './NodeCard';
export { AssetThumbnail } from './AssetThumbnail';

// src/components/organisms/index.ts
export { VideoEditor } from './VideoEditor';
export { AssetGallery } from './AssetGallery';
```

#### Task T006: Setup data validation framework
```bash
npm install joi
```

```typescript
// lib/validation.ts
import Joi from 'joi';

export const projectSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  campaignType: Joi.string().valid(
    'product-launch', 'social-ad', 'brand-awareness', 
    'event-promotion', 'educational-content'
  ).required(),
  aspectRatio: Joi.string().valid('9:16', '16:9', '1:1').required(),
  targetDuration: Joi.number().valid(15, 30, 60).required(),
});
```

---

## Phase 2: Foundational Implementation Strategy

### Goal: Core infrastructure that MUST be complete before ANY user story can be implemented

⚠️ **CRITICAL**: No user story work can begin until this phase is complete

#### Task T007: Setup Supabase database schema
```sql
-- Using Cursor/Copilot prompt:
-- "Create PostgreSQL schema for ViraCut MVP with the following tables:
-- - users (leveraging Supabase Auth)
-- - projects (video project metadata)
-- - nodes (React Flow nodes)
-- - connections (node connections)
-- - assets (uploaded media files)
-- - exports (export jobs)
-- Include proper indexes, constraints, and Row Level Security policies"

-- Run in Supabase SQL Editor or via migration
```

#### Task T008: Implement authentication framework
```typescript
// Using Cursor/Copilot prompt:
// "Create authentication service using Supabase Auth with:
// - Login/logout functionality
// - Session management
// - Token refresh
// - Protected route middleware
// - User profile management"

// src/services/auth.ts
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export class AuthService {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async login(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  }

  async logout() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async getSession() {
    const { data: { session } } = await this.supabase.auth.getSession();
    return session;
  }
}
```

#### Task T009: Setup API routing structure
```typescript
// Using Cursor/Copilot prompt:
// "Create Next.js 15 API route structure with:
// - Middleware for authentication
// - Error handling wrapper
// - CORS configuration
// - Request validation using Joi
// - Standardized response format"

// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Authentication logic
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token && !request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

#### Task T010: Create base models from data-model.md
```typescript
// Using Cursor/Copilot prompt:
// "Create TypeScript model interfaces based on the data model:
// - User model with profile fields
// - Project model with campaign settings
// - Node model with React Flow properties
// - Connection model for node relationships
// - Asset model for media files
// - Export model for video exports"

// src/models/types.ts
export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  campaign_type: CampaignType;
  aspect_ratio: AspectRatio;
  target_duration: number;
  brand_colors?: string[];
  brand_logo_url?: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export type CampaignType = 'product-launch' | 'social-ad' | 'brand-awareness' | 'event-promotion' | 'educational-content';
export type AspectRatio = '9:16' | '16:9' | '1:1';
export type ProjectStatus = 'draft' | 'processing' | 'completed' | 'error';
```

#### Task T011: Configure error handling and logging
```typescript
// Using Cursor/Copilot prompt:
// "Create comprehensive error handling system with:
// - Custom error classes
// - Error boundary components
// - Centralized error logging
// - User-friendly error messages
// - Error reporting to monitoring service"

// lib/errors.ts
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class APIError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// components/ErrorBoundary.tsx
'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-6">
              We're sorry, but something unexpected happened.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### Task T012: Setup environment configuration
```typescript
// lib/env.ts
export const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  NEXT_PUBLIC_OMNICLIP_API_KEY: process.env.NEXT_PUBLIC_OMNICLIP_API_KEY!,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL!,
  NODE_ENV: process.env.NODE_ENV || 'development',
};

// Validate required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_OMNICLIP_API_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!env[envVar as keyof typeof env]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
```

#### Task T013: Implement auto-save mechanism
```typescript
// Using Cursor/Copilot prompt:
// "Create auto-save system with:
// - Debounced saving to prevent excessive API calls
// - Local storage fallback for offline mode
// - Visual indicators for save status
// - Conflict resolution for concurrent edits
// - Recovery from failed saves"

// hooks/useAutoSave.ts
import { useEffect, useRef, useState } from 'react';
import { debounce } from 'lodash';

export function useAutoSave<T>(
  data: T,
  saveFunction: (data: T) => Promise<void>,
  delay = 2000
) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastSavedData = useRef<T>(data);

  const debouncedSave = useRef(
    debounce(async (dataToSave: T) => {
      try {
        setSaveStatus('saving');
        await saveFunction(dataToSave);
        lastSavedData.current = dataToSave;
        setSaveStatus('saved');
        
        // Reset to idle after 2 seconds
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        setSaveStatus('error');
        console.error('Auto-save failed:', error);
      }
    }, delay)
  ).current;

  useEffect(() => {
    if (JSON.stringify(data) !== JSON.stringify(lastSavedData.current)) {
      debouncedSave(data);
    }

    return () => {
      debouncedSave.cancel();
    };
  }, [data]);

  return { saveStatus };
}
```

#### Task T014: Setup Redux store for state management
```typescript
// Using Cursor/Copilot prompt:
// "Create Redux Toolkit store with:
// - Auth slice for user authentication
// - Projects slice for project management
// - Editor slice for React Flow state
// - Assets slice for media management
// - Persisted state for offline capability"

// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import authSlice from './slices/authSlice';
import projectsSlice from './slices/projectsSlice';
import editorSlice from './slices/editorSlice';
import assetsSlice from './slices/assetsSlice';

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth', 'editor'], // Only persist these slices
};

export const store = configureStore({
  reducer: {
    auth: persistReducer(persistConfig, authSlice),
    projects: projectsSlice,
    editor: editorSlice,
    assets: assetsSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export const persistor = persistStore(store);
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

#### Task T015: Create atomic design base components
```typescript
// Using Cursor/Copilot prompt:
// "Create atomic design components with:
// - Button component with variants and sizes
// - Input component with validation states
// - Modal component with accessibility
// - Loading states and skeletons
// - Mobile-responsive design"

// components/atoms/Button.tsx
import React from 'react';
import { cn } from '../../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  ...props
}) => {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        {
          'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500':
            variant === 'primary',
          'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500':
            variant === 'secondary',
          'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500':
            variant === 'danger',
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2 text-base': size === 'md',
          'px-6 py-3 text-lg': size === 'lg',
        },
        disabled || loading ? 'opacity-50 cursor-not-allowed' : '',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};
```

#### Task T016: Implement performance monitoring hooks
```typescript
// Using Cursor/Copilot prompt:
// "Create performance monitoring hooks with:
// - Render time tracking
// - Memory usage monitoring
// - Network request timing
// - Component render count
// - Performance budget alerts"

// hooks/usePerformanceMonitor.ts
import { useEffect, useRef, useState } from 'react';

export function useRenderTime(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());

  useEffect(() => {
    renderCount.current += 1;
    const now = performance.now();
    const renderTime = now - lastRenderTime.current;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[Performance] ${componentName} render #${renderCount.current}: ${renderTime.toFixed(2)}ms`
      );
      
      if (renderTime > 16.67) { // More than 60fps threshold
        console.warn(
          `[Performance Warning] ${componentName} render took ${renderTime.toFixed(2)}ms`
        );
      }
    }
    
    lastRenderTime.current = now;
  });

  return renderCount.current;
}

export function useMemoryMonitor() {
  const [memoryUsage, setMemoryUsage] = useState<{
    used: number;
    total: number;
    percentage: number;
  } | null>(null);

  useEffect(() => {
    const updateMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMemoryUsage({
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
        });
      }
    };

    const interval = setInterval(updateMemoryUsage, 5000);
    updateMemoryUsage();

    return () => clearInterval(interval);
  }, []);

  return memoryUsage;
}
```

#### Task T017: Setup Supabase Storage integration
```typescript
// Using Cursor/Copilot prompt:
// "Create Supabase Storage service with:
// - File upload with progress tracking
// - Automatic image/video optimization
// - CDN URL generation
// - Access control policies
// - Multiple file type support"

// services/storage.ts
import { createClient } from '@supabase/supabase-js';

export class StorageService {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async uploadFile(
    file: File,
    path: string,
    onProgress?: (progress: number) => void
  ): Promise<{ url: string; path: string }> {
    const { data, error } = await this.supabase.storage
      .from('assets')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data: { publicUrl } } = this.supabase.storage
      .from('assets')
      .getPublicUrl(data.path);

    return { url: publicUrl, path: data.path };
  }

  async deleteFile(path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from('assets')
      .remove([path]);

    if (error) throw error;
  }

  getPublicUrl(path: string): string {
    const { data: { publicUrl } } = this.supabase.storage
      .from('assets')
      .getPublicUrl(path);

    return publicUrl;
  }
}
```

#### Task T018: Configure Omniclip SDK integration
```typescript
// Using Cursor/Copilot prompt:
// "Create Omniclip SDK integration with:
// - Video processing pipeline
// - Export configuration options
// - Progress tracking
// - Error handling
// - Multiple format support"

// services/omniclip.ts
export class OmniclipService {
  private apiKey: string;
  private baseUrl = 'https://api.omniclip.dev/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async processVideo(
    sourceUrl: string,
    operations: VideoOperation[],
    onProgress?: (progress: number) => void
  ): Promise<ProcessResult> {
    const response = await fetch(`${this.baseUrl}/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: sourceUrl,
        operations,
        webhook: `${process.env.NEXT_PUBLIC_API_URL}/webhooks/omniclip`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Omniclip API error: ${response.statusText}`);
    }

    const job = await response.json();

    // Poll for progress
    return this.pollJobStatus(job.id, onProgress);
  }

  private async pollJobStatus(
    jobId: string,
    onProgress?: (progress: number) => void
  ): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const response = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to check job status: ${response.statusText}`);
          }

          const job = await response.json();

          if (onProgress) {
            onProgress(job.progress);
          }

          if (job.status === 'completed') {
            resolve(job.result);
          } else if (job.status === 'failed') {
            reject(new Error(job.error));
          } else {
            setTimeout(poll, 1000); // Poll every second
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }
}

interface VideoOperation {
  type: string;
  parameters: Record<string, any>;
}

interface ProcessResult {
  url: string;
  size: number;
  duration: number;
  format: string;
}
```

---

## Phase 3-7: User Stories Implementation Strategy

### Phase 3: User Story 1 - User Authentication

#### Goal: Enable users to register, login, and manage their accounts

#### Task T021-T029: Authentication Implementation
```typescript
// Using Cursor/Copilot prompt for each task:
// "Create authentication components with:
// - Registration form with validation
// - Login form with error handling
// - Profile management page
// - Session persistence
// - Protected routes middleware"

// pages/auth/register.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { useAuth } from '../../hooks/useAuth';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      await register(formData);
      router.push('/dashboard');
    } catch (error: any) {
      setErrors({ general: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* Form fields implementation */}
        </form>
      </div>
    </div>
  );
}
```

### Phase 4: User Story 2 - Project Management

#### Goal: Enable users to create, view, and manage video projects

#### Task T032-T041: Project Management Implementation
```typescript
// Using Cursor/Copilot prompt:
// "Create project management system with:
// - Project creation wizard
// - Project listing with search/filter
// - Project detail view
// - CRUD operations for projects
// - Project status management"

// pages/projects/create.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/atoms/Button';
import { useProjects } from '../../hooks/useProjects';

export default function CreateProjectPage() {
  const [projectData, setProjectData] = useState({
    name: '',
    campaignType: 'product-launch',
    aspectRatio: '9:16',
    targetDuration: 30,
    brandColors: [],
  });
  const { createProject } = useProjects();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const project = await createProject(projectData);
      router.push(`/projects/${project.id}`);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Create New Project</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Form implementation */}
      </form>
    </div>
  );
}
```

### Phase 5: User Story 3 - Video Asset Management

#### Goal: Enable users to upload and manage video assets for their projects

#### Task T044-T052: Asset Management Implementation
```typescript
// Using Cursor/Copilot prompt:
// "Create asset management system with:
// - Drag-and-drop file upload
// - Progress tracking for uploads
// - Asset gallery with thumbnails
// - File type validation
// - Asset metadata extraction"

// components/organisms/AssetUpload.tsx
'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '../atoms/Button';
import { StorageService } from '../../services/storage';

interface AssetUploadProps {
  projectId: string;
  onUploadComplete: (asset: any) => void;
}

export function AssetUpload({ projectId, onUploadComplete }: AssetUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const storageService = new StorageService();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true);
    setProgress(0);

    for (const file of acceptedFiles) {
      try {
        const path = `${projectId}/${Date.now()}-${file.name}`;
        const result = await storageService.uploadFile(
          file,
          path,
          (progress) => setProgress(progress)
        );

        // Save asset to database
        const asset = await saveAssetToDatabase({
          projectId,
          name: file.name,
          url: result.url,
          type: getFileType(file.type),
          size: file.size,
        });

        onUploadComplete(asset);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }

    setUploading(false);
    setProgress(0);
  }, [projectId, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif'],
      'audio/*': ['.mp3', '.wav', '.aac'],
    },
  });

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
      <div {...getRootProps()} className="text-center cursor-pointer">
        <input {...getInputProps()} />
        
        {uploading ? (
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Uploading...</div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-gray-600">
              {isDragActive
                ? 'Drop the files here...'
                : 'Drag and drop files here, or click to select'}
            </div>
            <Button type="button" variant="secondary">
              Browse Files
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Phase 6: User Story 4 - Node-Based Video Editor

#### Goal: Enable users to create and edit videos using a node-based interface

#### Task T055-T073: Video Editor Implementation
```typescript
// Using Cursor/Copilot prompt:
// "Create React Flow-based video editor with:
// - Custom node types for video editing
// - Drag-and-drop functionality
// - Connection validation
// - Real-time preview
// - Mobile-responsive controls"

// components/organisms/VideoEditor.tsx
'use client';

import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { VideoInputNode } from '../molecules/nodes/VideoInputNode';
import { TextNode } from '../molecules/nodes/TextNode';
import { AudioNode } from '../molecules/nodes/AudioNode';
import { EffectNode } from '../molecules/nodes/EffectNode';

const nodeTypes = {
  videoInput: VideoInputNode,
  text: TextNode,
  audio: AudioNode,
  effect: EffectNode,
};

interface VideoEditorProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
}

export function VideoEditor({
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
}: VideoEditorProps) {
  const [nodes, setNodes, onNodesChangeHandler] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeHandler] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodesChangeInternal = useCallback(
    (changes: any) => {
      onNodesChangeHandler(changes);
      onNodesChange?.(nodes);
    },
    [nodes, onNodesChange, onNodesChangeHandler]
  );

  const onEdgesChangeInternal = useCallback(
    (changes: any) => {
      onEdgesChangeHandler(changes);
      onEdgesChange?.(edges);
    },
    [edges, onEdgesChange, onEdgesChangeHandler]
  );

  return (
    <div className="w-full h-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeInternal}
        onEdgesChange={onEdgesChangeInternal}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls />
        <MiniMap />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}

// components/molecules/nodes/VideoInputNode.tsx
import React from 'react';
import { Handle, Position } from 'reactflow';

interface VideoInputNodeProps {
  data: {
    source?: string;
    trimStart: number;
    trimEnd: number;
    brightness: number;
    contrast: number;
  };
}

export function VideoInputNode({ data }: VideoInputNodeProps) {
  return (
    <div className="bg-white border rounded-lg shadow-lg p-4 min-w-[200px]">
      <Handle type="source" position={Position.Right} />
      
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Video Input</h3>
        
        {data.source ? (
          <video
            src={data.source}
            className="w-full h-24 object-cover rounded"
            muted
          />
        ) : (
          <div className="w-full h-24 bg-gray-200 rounded flex items-center justify-center">
            <span className="text-gray-500 text-xs">No video</span>
          </div>
        )}
        
        <div className="text-xs text-gray-600">
          <div>Trim: {data.trimStart}s - {data.trimEnd}s</div>
          <div>Brightness: {data.brightness}%</div>
          <div>Contrast: {data.contrast}%</div>
        </div>
      </div>
    </div>
  );
}
```

### Phase 7: User Story 5 - Video Export

#### Goal: Enable users to export their edited videos

#### Task T076-T088: Video Export Implementation
```typescript
// Using Cursor/Copilot prompt:
// "Create video export system with:
// - Export settings configuration
// - Progress tracking with real-time updates
// - Multiple format support
// - Export queue management
// - Download and sharing options"

// components/organisms/ExportSettings.tsx
'use client';

import { useState } from 'react';
import { Button } from '../atoms/Button';
import { ExportSettings as ExportSettingsType } from '../../models/types';

interface ExportSettingsProps {
  projectId: string;
  onExport: (settings: ExportSettingsType) => void;
  loading?: boolean;
}

export function ExportSettings({ projectId, onExport, loading }: ExportSettingsProps) {
  const [settings, setSettings] = useState<ExportSettingsType>({
    format: 'mp4',
    resolution: '1080p',
    quality: 'high',
    frameRate: 30,
    audioCodec: 'aac',
    audioBitrate: 128,
    videoBitrate: 5000,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExport(settings);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <h2 className="text-xl font-semibold">Export Settings</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Format
          </label>
          <select
            value={settings.format}
            onChange={(e) => setSettings({ ...settings, format: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="mp4">MP4</option>
            <option value="webm">WebM</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Resolution
          </label>
          <select
            value={settings.resolution}
            onChange={(e) => setSettings({ ...settings, resolution: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quality
          </label>
          <select
            value={settings.quality}
            onChange={(e) => setSettings({ ...settings, quality: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <Button
          type="submit"
          loading={loading}
          className="w-full"
        >
          Export Video
        </Button>
      </form>
    </div>
  );
}

// components/organisms/ExportProgress.tsx
'use client';

import { useEffect, useState } from 'react';
import { ExportJob } from '../../models/types';

interface ExportProgressProps {
  jobId: string;
  onComplete: (url: string) => void;
  onError: (error: string) => void;
}

export function ExportProgress({ jobId, onComplete, onError }: ExportProgressProps) {
  const [job, setJob] = useState<ExportJob | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const pollJob = async () => {
      try {
        const response = await fetch(`/api/exports/${jobId}`);
        const jobData = await response.json();
        
        setJob(jobData);
        setProgress(jobData.progress || 0);

        if (jobData.status === 'completed') {
          onComplete(jobData.url);
        } else if (jobData.status === 'failed') {
          onError(jobData.error_message || 'Export failed');
        } else if (jobData.status === 'processing') {
          setTimeout(pollJob, 1000);
        }
      } catch (error) {
        onError('Failed to check export status');
      }
    };

    pollJob();
  }, [jobId, onComplete, onError]);

  if (!job) {
    return <div>Initializing export...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <h3 className="font-semibold">Exporting Video</h3>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="text-sm text-gray-600">
          Status: {job.status}
        </div>
      </div>
    </div>
  );
}
```

---

## Phase 8: Polish & Cross-Cutting Concerns

### Goal: Improvements that affect multiple user stories

#### Task T107-T124: Polish Implementation

##### Documentation Updates
```markdown
# Create comprehensive documentation
- API documentation with OpenAPI/Swagger
- Component library documentation
- Deployment guides
- Troubleshooting guides
```

##### Performance Optimization
```typescript
// Using Cursor/Copilot prompt:
// "Implement performance optimizations:
// - Code splitting and lazy loading
// - Image optimization with next/image
// - Bundle size analysis and optimization
// - Service worker for offline support
// - Critical resource preloading"

// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizeCss: true,
  },
  images: {
    domains: ['your-supabase-project.supabase.co'],
    formats: ['image/webp', 'image/avif'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      };
    }
    return config;
  },
};

module.exports = nextConfig;
```

##### Mobile Responsiveness
```typescript
// Using Cursor/Copilot prompt:
// "Optimize for mobile devices:
// - Touch-friendly controls
// - Gesture support for React Flow
// - Responsive layouts
// - Mobile-specific keyboard shortcuts
// - Performance optimizations for mobile"

// hooks/useTouchGestures.ts
import { useEffect, useRef } from 'react';

export function useTouchGestures(
  element: HTMLElement | null,
  onPinch?: (scale: number) => void,
  onPan?: (deltaX: number, deltaY: number) => void
) {
  const lastTouchDistance = useRef<number>(0);
  const lastTouchPosition = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy);
      } else if (e.touches.length === 1) {
        lastTouchPosition.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && onPinch) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const scale = distance / lastTouchDistance.current;
        onPinch(scale);
        lastTouchDistance.current = distance;
      } else if (e.touches.length === 1 && onPan && lastTouchPosition.current) {
        const deltaX = e.touches[0].clientX - lastTouchPosition.current.x;
        const deltaY = e.touches[0].clientY - lastTouchPosition.current.y;
        onPan(deltaX, deltaY);
        lastTouchPosition.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    };

    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchmove', handleTouchMove);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
    };
  }, [element, onPinch, onPan]);
}
```

---

## AI-Assisted Development with Cursor/Copilot

### Using Cursor for In-Context Code Generation

#### Best Practices for Prompt Engineering

1. **Be Specific About Requirements**
   ```bash
   # Good prompt:
   "Create a React component for video upload with:
   - Drag and drop functionality using react-dropzone
   - Progress bar showing upload percentage
   - File type validation for video formats
   - Preview thumbnail generation
   - Mobile-responsive design with Tailwind CSS"
   
   # Avoid vague prompts:
   "Create a video upload component"
   ```

2. **Provide Context and Constraints**
   ```bash
   "Create a Redux slice for project management with:
   - Async thunks for CRUD operations
   - Optimistic updates for better UX
   - Error handling with user-friendly messages
   - Loading states for each operation
   - Integration with Supabase API"
   ```

3. **Specify File Structure and Patterns**
   ```bash
   "Create API route at pages/api/projects/[id].ts with:
   - GET method to fetch project details
   - PUT method to update project
   - DELETE method to remove project
   - Authentication middleware
   - Joi validation for request body
   - Standardized error responses"
   ```

#### Leveraging Copilot for Boilerplate

1. **Database Models**
   ```typescript
   // Prompt: "Create TypeScript interfaces for the following database tables:
   // - users with auth integration
   // - projects with campaign settings
   // - nodes with React Flow properties
   // Include proper types, optional fields, and relationships"
   ```

2. **API Endpoints**
   ```typescript
   // Prompt: "Generate Next.js API route for user authentication with:
   // - POST /api/auth/login
   // - POST /api/auth/register
   // - GET /api/auth/me
   // Include Supabase auth integration and error handling"
   ```

3. **React Components**
   ```typescript
   // Prompt: "Create a reusable modal component with:
   // - Accessibility features (ARIA labels)
   // - Click outside to close
   // - Escape key support
   // - Customizable header and footer
   // - Mobile-responsive design"
   ```

### Code Review and Refactoring with AI

1. **Performance Optimization**
   ```bash
   "Review this React component for performance issues:
   - Identify unnecessary re-renders
   - Suggest memoization opportunities
   - Recommend code splitting strategies
   - Optimize bundle size impact"
   ```

2. **Security Hardening**
   ```bash
   "Audit this authentication code for security vulnerabilities:
   - Check for XSS protection
   - Validate input sanitization
   - Review token storage methods
   - Suggest security best practices"
   ```

---

## Atomic Commits Best Practices

### Commit Message Format

```bash
# Format: <type>(<scope>): <description>

# Types:
# feat:     New feature
# fix:      Bug fix
# docs:     Documentation changes
# style:    Code formatting (no functional changes)
# refactor: Code refactoring
# test:     Test additions or modifications
# chore:    Build process or auxiliary tool changes

# Examples:
feat(auth): add user registration with email verification
fix(editor): resolve node connection validation issue
docs(api): update authentication endpoint documentation
test(projects): add integration tests for project CRUD
```

### Atomic Commit Strategy

1. **One Feature Per Commit**
   ```bash
   # Good: Separate commits for each feature
   git add components/VideoInputNode.tsx
   git commit -m "feat(nodes): implement video input node component"
   
   git add services/omniclip.ts
   git commit -m "feat(video): integrate Omniclip SDK for processing"
   
   # Avoid: Multiple features in one commit
   git add .
   git commit -m "feat: add video editor features" # Too broad
   ```

2. **Commit Related Changes Together**
   ```bash
   # Good: Component and its styles together
   git add components/Button.tsx components/Button.module.css
   git commit -m "feat(ui): create reusable button component"
   
   # Good: Model and its validation schema
   git add models/project.ts validation/projectSchema.ts
   git commit -m "feat(models): add project model with validation"
   ```

3. **Test Alongside Implementation**
   ```bash
   # Good: Feature and its tests
   git add services/auth.ts
   git add tests/unit/auth.test.ts
   git commit -m "feat(auth): implement authentication service with tests"
   ```

### Branching Strategy

```bash
# Feature branches
git checkout -b feature/user-authentication
# Work on authentication features
git checkout -b feature/video-editor
# Work on editor features

# Release branches
git checkout -b release/v1.0.0
# Prepare for release, only bug fixes

# Hotfix branches
git checkout -b hotfix/critical-security-fix
# Emergency fixes to main
```

---

## Verification Steps for Vercel Deployment

### Pre-Deployment Checklist

1. **Code Quality Checks**
   ```bash
   # Run all quality checks
   npm run lint          # Check code style
   npm run type-check    # Verify TypeScript types
   npm run test          # Run all tests
   npm run build         # Verify production build
   ```

2. **Environment Variables**
   ```bash
   # Verify all required variables are set
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
   echo $NEXT_PUBLIC_OMNICLIP_API_KEY
   echo $NEXT_PUBLIC_APP_URL
   ```

3. **Performance Budget**
   ```bash
   # Analyze bundle size
   npm run analyze
   
   # Check Lighthouse score
   npx lighthouse http://localhost:3000 --output=json --output-path=./lighthouse.json
   ```

### Vercel Deployment Configuration

```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ],
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key",
    "NEXT_PUBLIC_OMNICLIP_API_KEY": "@omniclip-api-key"
  },
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

### Post-Deployment Verification

1. **Smoke Tests**
   ```bash
   # Test critical paths
   curl -f https://your-app.vercel.app/api/health
   curl -f https://your-app.vercel.app/
   curl -f https://your-app.vercel.app/login
   ```

2. **Database Connectivity**
   ```typescript
   // Test endpoint to verify database connection
   // pages/api/health.ts
   export default async function handler(req, res) {
     try {
       const { data, error } = await supabase.from('users').select('count');
       
       if (error) throw error;
       
       res.status(200).json({ 
         status: 'healthy',
         database: 'connected',
         timestamp: new Date().toISOString()
       });
     } catch (error) {
       res.status(500).json({ 
         status: 'unhealthy',
         error: error.message 
       });
     }
   }
   ```

3. **Performance Monitoring**
   ```bash
   # Check Core Web Vitals
   npx lighthouse https://your-app.vercel.app --output=json --output-path=./production-lighthouse.json
   
   # Verify performance targets
   # - First Contentful Paint < 1.8s
   # - Largest Contentful Paint < 2.5s
   # - Cumulative Layout Shift < 0.1
   # - First Input Delay < 100ms
   ```

---

## Technical Implementation Details

### React Flow Integration for Video Editor

#### Custom Node Types Implementation

```typescript
// lib/reactFlowConfig.ts
import { NodeTypes } from 'reactflow';
import { VideoInputNode } from '../components/molecules/nodes/VideoInputNode';
import { TextNode } from '../components/molecules/nodes/TextNode';
import { AudioNode } from '../components/molecules/nodes/AudioNode';
import { EffectNode } from '../components/molecules/nodes/EffectNode';
import { ShapeNode } from '../components/molecules/nodes/ShapeNode';
import { LogoNode } from '../components/molecules/nodes/LogoNode';
import { ExportNode } from '../components/molecules/nodes/ExportNode';

export const nodeTypes: NodeTypes = {
  videoInput: VideoInputNode,
  text: TextNode,
  audio: AudioNode,
  effect: EffectNode,
  shape: ShapeNode,
  logo: LogoNode,
  export: ExportNode,
};

// Node validation rules
export const nodeValidationRules = {
  videoInput: {
    maxConnections: 1,
    requiredHandles: ['output'],
    acceptsConnections: ['text', 'effect', 'audio', 'export'],
  },
  text: {
    maxConnections: 2,
    requiredHandles: ['input', 'output'],
    acceptsConnections: ['videoInput', 'imageInput', 'effect'],
  },
  // ... other node rules
};
```

#### Connection Validation Logic

```typescript
// lib/connectionValidation.ts
import { Connection, Node } from 'reactflow';
import { nodeValidationRules } from './reactFlowConfig';

export function validateConnection(
  connection: Connection,
  nodes: Node[]
): { valid: boolean; reason?: string } {
  const { source, target, sourceHandle, targetHandle } = connection;
  
  if (!source || !target) {
    return { valid: false, reason: 'Invalid connection' };
  }

  const sourceNode = nodes.find(n => n.id === source);
  const targetNode = nodes.find(n => n.id === target);
  
  if (!sourceNode || !targetNode) {
    return { valid: false, reason: 'Node not found' };
  }

  const sourceRules = nodeValidationRules[sourceNode.type as keyof typeof nodeValidationRules];
  const targetRules = nodeValidationRules[targetNode.type as keyof typeof nodeValidationRules];

  // Check if target accepts this connection type
  if (!targetRules.acceptsConnections.includes(sourceNode.type)) {
    return { 
      valid: false, 
      reason: `${targetNode.type} cannot accept connections from ${sourceNode.type}` 
    };
  }

  // Check connection limits
  const existingConnections = countConnections(targetNode.id, nodes);
  if (existingConnections >= targetRules.maxConnections) {
    return { 
      valid: false, 
      reason: `${targetNode.type} has reached maximum connections` 
    };
  }

  return { valid: true };
}

function countConnections(nodeId: string, nodes: Node[]): number {
  // Count existing connections for the node
  // Implementation depends on how you store connections
  return 0; // Placeholder
}
```

### Supabase Integration Patterns

#### Real-time Subscriptions

```typescript
// hooks/useRealtimeSubscription.ts
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export function useRealtimeSubscription<T>(
  table: string,
  filter?: { column: string; value: any }
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let query = supabase.from(table).select('*');
    
    if (filter) {
      query = query.eq(filter.column, filter.value);
    }

    // Initial fetch
    const fetchData = async () => {
      try {
        const { data: result, error: fetchError } = await query;
        
        if (fetchError) throw fetchError;
        setData(result);
        setLoading(false);
      } catch (err) {
        setError(err as Error);
        setLoading(false);
      }
    };

    fetchData();

    // Real-time subscription
    const subscription = supabase
      .channel(`${table}_changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setData(prev => [...prev, payload.new as T]);
          } else if (payload.eventType === 'UPDATE') {
            setData(prev => 
              prev.map(item => 
                (item as any).id === payload.new.id ? payload.new as T : item
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setData(prev => 
              prev.filter(item => (item as any).id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [table, filter]);

  return { data, loading, error };
}
```

#### File Upload with Progress

```typescript
// services/uploadService.ts
import { createClient } from '@supabase/supabase-js';

export class UploadService {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async uploadFileWithProgress(
    file: File,
    path: string,
    onProgress?: (progress: number) => void
  ): Promise<{ url: string; path: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(Math.round(progress));
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          const { data } = response;
          
          // Get public URL
          const { data: { publicUrl } } = this.supabase.storage
            .from('assets')
            .getPublicUrl(data.path);

          resolve({ url: publicUrl, path: data.path });
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      // Create signed upload URL
      this.createSignedUploadUrl(path)
        .then(({ signedUrl, token }) => {
          // Upload file using signed URL
          xhr.open('PUT', signedUrl, true);
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.send(file);
        })
        .catch(reject);
    });
  }

  private async createSignedUploadUrl(path: string) {
    const { data, error } = await this.supabase.storage
      .from('assets')
      .createSignedUploadUrl(path);

    if (error) throw error;
    return data;
  }
}
```

### Video Processing Pipeline

#### Export Job Management

```typescript
// services/exportService.ts
export class ExportService {
  async createExportJob(
    projectId: string,
    settings: ExportSettings,
    nodes: Node[],
    connections: Edge[]
  ): Promise<ExportJob> {
    // Validate export pipeline
    const validation = this.validateExportPipeline(nodes, connections);
    if (!validation.valid) {
      throw new Error(`Invalid export pipeline: ${validation.reason}`);
    }

    // Create export job record
    const job = await this.createExportRecord(projectId, settings);
    
    // Queue for processing
    await this.queueExportProcessing(job.id, nodes, connections, settings);
    
    return job;
  }

  private validateExportPipeline(
    nodes: Node[],
    connections: Edge[]
  ): { valid: boolean; reason?: string } {
    // Check for required nodes
    const hasVideoInput = nodes.some(n => n.type === 'videoInput');
    const hasExportNode = nodes.some(n => n.type === 'export');
    
    if (!hasVideoInput) {
      return { valid: false, reason: 'Missing video input node' };
    }
    
    if (!hasExportNode) {
      return { valid: false, reason: 'Missing export node' };
    }

    // Validate connections form a valid pipeline
    const exportNode = nodes.find(n => n.type === 'export');
    const hasInputToExport = connections.some(c => c.target === exportNode?.id);
    
    if (!hasInputToExport) {
      return { valid: false, reason: 'Export node has no input' };
    }

    return { valid: true };
  }

  private async queueExportProcessing(
    jobId: string,
    nodes: Node[],
    connections: Edge[],
    settings: ExportSettings
  ): Promise<void> {
    // Send to processing queue (could be Redis, BullMQ, etc.)
    await fetch('/api/exports/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        nodes,
        connections,
        settings,
      }),
    });
  }
}
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. React Flow Performance Issues

**Problem**: Lag when dragging nodes or panning canvas
```typescript
// Solution: Optimize React Flow rendering
const MemoizedVideoEditor = React.memo(VideoEditor);

// Use useCallback for event handlers
const onNodesChange = useCallback((changes) => {
  // Handle node changes
}, []);

// Implement node virtualization for large graphs
const nodeTypes = useMemo(() => ({
  videoInput: VideoInputNode,
  text: TextNode,
  // ... other nodes
}), []);
```

#### 2. Supabase RLS Policy Issues

**Problem**: Permission denied errors on database operations
```sql
-- Solution: Debug RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'projects';

-- Check current user context
SELECT auth.uid(), auth.role();
```

#### 3. Video Upload Failures

**Problem**: Large file uploads timing out
```typescript
// Solution: Implement chunked uploads
async uploadLargeFile(file: File, path: string) {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    await this.uploadChunk(chunk, path, chunkIndex, totalChunks);
  }
}
```

#### 4. Mobile Touch Issues

**Problem**: React Flow not responding to touch gestures
```typescript
// Solution: Custom touch handling for mobile
const TouchFlowProvider = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  return (
    <ReactFlowProvider>
      {isMobile ? (
        <MobileFlowWrapper>
          {children}
        </MobileFlowWrapper>
      ) : (
        children
      )}
    </ReactFlowProvider>
  );
};
```

### Debug Mode Configuration

```typescript
// lib/debug.ts
export const debug = {
  log: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.log('[DEBUG]', ...args);
    }
  },
  
  error: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.error('[DEBUG ERROR]', ...args);
    }
  },
  
  group: (label: string, fn: () => void) => {
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.group(`[DEBUG] ${label}`);
      fn();
      console.groupEnd();
    }
  },
};

// Usage in components
debug.group('VideoEditor Render', () => {
  debug.log('Nodes:', nodes.length);
  debug.log('Edges:', edges.length);
  debug.log('Viewport:', viewport);
});
```

---

## Conclusion

This implementation plan provides a comprehensive guide for developing the ViraCut MVP following the sequential task structure from Foundation → Canvas → Assets → Editor → Polish. Key takeaways:

1. **Phase-Based Development**: Complete each phase fully before proceeding to ensure solid foundations
2. **Atomic Commits**: Maintain clean git history with descriptive, focused commits
3. **Mobile-First Approach**: Optimize for mobile experience throughout development
4. **Performance Targets**: Continuously monitor and optimize against performance goals
5. **AI-Assisted Development**: Leverage Cursor/Copilot effectively with specific, contextual prompts
6. **Verification Steps**: Thoroughly test each phase before deployment to Vercel staging

Following this plan will ensure a systematic, high-quality implementation of the ViraCut MVP that meets all technical requirements and performance targets.

### Next Steps

1. Begin with Phase 1: Setup implementation
2. Complete Phase 2: Foundational infrastructure before any user stories
3. Implement user stories sequentially (US1 → US5 for MVP)
4. Deploy to staging after each phase for verification
5. Complete Phase 8: Polish before production deployment

For additional resources, refer to:
- [ViraCut MVP Specification](.specify/memory/viracut-mvp-spec.md)
- [Data Model Documentation](../specs/master/data-model.md)
- [Quickstart Guide](../specs/master/quickstart.md)
- [API Contracts](../specs/master/contracts.md)