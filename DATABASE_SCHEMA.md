# Scrimspec Database Schema

## Schema Overview

The Scrimspec database utilizes a multi-schema approach to organize different aspects of the system:

### Core Schemas

1. **public** - Main application tables and core entities
2. **aes_core** - Emotional architecture definitions and templates
3. **generation_pipeline** - Video generation workflow and assets
4. **jobs** - Background job processing queues
5. **analytics** - Performance metrics and data analysis
6. **auth** - Authentication and user management (Supabase)
7. **storage** - File storage metadata and management

## Detailed Schema Descriptions

### `public` Schema

The public schema contains the core application tables:

#### Projects and Content Creation
- **projects** - Content creation projects with metadata
- **scenes** - Individual scenes within projects
- **assets** - Media assets (images, videos, audio)
- **jobs** - Processing jobs for content generation
- **harvests** - YouTube data collection batches
- **videos** - Harvested YouTube videos
- **analysis_tasks** - Video analysis processing tasks
- **analysis_docs** - Analysis results and reports

#### Library Components
- **presets** - Story templates and presets
- **characters** - Character definitions and metadata
- **workers** - Background processing workers
- **signals** - Aggregated pattern data from analysis
- **snapshots** - Immutable knowledge snapshots

#### System Tables
- **audit_log** - Audit trail for data modifications
- **batches** - Batch processing jobs
- **clips** - Generated video clips
- **tasks** - Legacy task processing table
- **youtube_videos** - YouTube video metadata
- **generation_events** - Content generation events

### `aes_core` Schema

Emotional architecture core definitions:

- **story_templates** - Predefined story structures
- **beats** - Individual emotional beats within templates
- **phase_enum** - AES phases (HOOK, BUILD, PAYOFF, RESOLUTION)
- **emotion_enum** - Emotional states taxonomy
- **contrast_enum** - Emotional contrast patterns

### `generation_pipeline` Schema

Video generation workflow tables:

- **shorts** - Generated short videos
- **assets** - Generation assets with metadata
- **jobs** - Generation provider jobs

### `jobs` Schema

Background processing queues:

- **analysis_queue** - Video analysis jobs
- **generation_queue** - Content generation jobs
- **ingest_queue** - Data ingestion jobs

### `analytics` Schema

Performance and metrics tracking:

- **metrics_snapshots** - Point-in-time performance metrics
- **performance_metrics** - Aggregated performance data

### `auth` Schema

Supabase authentication tables:

- **users** - User accounts
- **identities** - Authentication identities
- **sessions** - User sessions
- **refresh_tokens** - Session refresh tokens

## Key Tables and Relationships

### Core Content Creation Flow

```
projects
├── scenes
│   ├── assets (first/last frame images)
│   └── jobs (generation tasks)
└── jobs (project-level tasks)

harvests
└── videos
    ├── analysis_tasks
    └── analysis_docs
```

### Generation Pipeline

```
generation_pipeline.shorts
├── generation_pipeline.assets
│   └── generation_pipeline.jobs
└── jobs.generation_queue
```

### User Management

```
auth.users
├── auth.identities
├── auth.sessions
└── auth.refresh_tokens
```

## Row Level Security (RLS) Policies

The database implements Row Level Security for data isolation:

### `generation_pipeline` Schema
- Users can view, insert, update, and delete assets and shorts they own
- Ownership determined by `owner_id` field
- Public access restricted to authenticated users

### `public` Schema
- Authenticated users can access core application tables
- Specific policies for sensitive data like audit logs

## Known Issues and Optimizations

### Structural Issues
1. **Legacy ID Mapping** - Dual ID system (legacy TEXT and UUID) creates complexity
2. **Duplicate Tables** - Similar tables exist in both public and generation_pipeline schemas
3. **Inconsistent Naming** - Mixed naming conventions across schemas

### Performance Considerations
1. **Index Coverage** - Comprehensive indexing on frequently queried columns
2. **Materialized Views** - Pre-computed analytics for performance
3. **Partitioning** - Time-based partitioning for audit logs and metrics

### Missing Relationships
1. **Foreign Key Constraints** - Some logical relationships lack explicit FK constraints
2. **Cascade Operations** - Inconsistent cascade delete behavior
3. **Data Integrity** - Limited check constraints on business rules

## Potential Optimizations

1. **Query Performance** - Add indexes on frequently joined columns
2. **Storage Optimization** - Archive old audit logs and metrics
3. **Normalization** - Consolidate duplicate table structures
4. **Constraint Enforcement** - Add missing foreign key constraints
5. **Partitioning Strategy** - Implement more aggressive time-based partitioning

## Schema Evolution Recommendations

1. **Consolidate Duplicate Tables** - Merge similar tables across schemas
2. **Standardize Naming** - Apply consistent naming conventions
3. **Enhance Documentation** - Add detailed column comments and descriptions
4. **Improve Constraints** - Add comprehensive data validation rules
5. **Optimize Indexes** - Review and refine indexing strategy based on query patterns

This schema documentation provides a comprehensive overview of the database structure and relationships within the Scrimspec system.