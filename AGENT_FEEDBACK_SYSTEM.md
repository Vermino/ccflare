# Agent Feedback System for ccflare 🤖📊

## Overview

This document outlines the comprehensive agent feedback and reinforcement learning system to be integrated into ccflare. The system will track Claude Code agent performance across user projects, provide LLM-based performance reviews, and enable version management with rollback capabilities.

## Core Architecture

### Integration with ccflare Proxy
- **Middleware Integration**: Hook into `handleProxy` in `apps/server/src/server.ts` to intercept Claude Code requests/responses
- **Project Discovery**: Scan user's drive for `.claude` files to identify active Claude Code projects
- **Session Tracking**: Log agent interactions, decisions, and outcomes through the existing proxy infrastructure
- **Database Extensions**: Extend ccflare's SQLite database with feedback-specific tables

### Key Components

#### 1. Project Discovery & Tracking
- Automated scanning for `.claude` files across user's filesystem
- Project registry with metadata (path, creation date, last activity, agent types used)
- Real-time monitoring of project activity through proxy requests
- Project lifecycle tracking and usage patterns

#### 2. Session Logging Framework
- Capture agent interactions, tool usage, and task outcomes
- Log user feedback (explicit ratings, corrections, preferences)
- Record performance metrics (completion time, iterations, success rates)
- Store conversation context and decision trees
- Track code quality metrics and error patterns

#### 3. LLM-Based Performance Review System
- **Review Process**:
  1. Collect session data (success rates, user feedback, error patterns)
  2. LLM Reviewer analyzes patterns and suggests improvements
  3. Generate new agent version with proposed optimizations
  4. User notification: "Agent v1.2 ready - improved code generation by 15%"
  5. User can test, accept, or reject the new version

- **Review Cadence**: User-configurable scheduling
  - Daily: Quick iterations for active projects
  - Weekly: Balanced approach for most users
  - Monthly: Stable versions for production environments
  - On-demand: Manual trigger when improvements needed

#### 4. Agent Version Management & Rollback
- **Git-like Versioning System**:
  ```
  general-purpose-v1.0
  ├── v1.1 (improved error handling)
  ├── v1.2 (better code style)
  └── v1.1-branch-custom (user reverted to v1.1, custom improvements)
  ```

- **User Controls**:
  - "Try new version" (A/B testing period)
  - "Rollback to v1.1" (instant revert)
  - "Branch from v1.1" (create custom improvement path)
  - Version comparison reports

#### 5. Feedback Collection System
- **Implicit Feedback**: Task success/failure, code quality metrics, performance data
- **Explicit Feedback**: User ratings, corrections, preferences, satisfaction scores
- **Behavioral Patterns**: Which approaches work best for different project types
- **Real-time Collection**: During sessions via proxy middleware
- **Post-session Surveys**: Optional detailed feedback forms

## Database Schema Extensions

```sql
-- Project tracking
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT UNIQUE NOT NULL,
  claude_file_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME,
  total_sessions INTEGER DEFAULT 0,
  avg_satisfaction REAL DEFAULT 0.0
);

-- Agent version management
CREATE TABLE agent_versions (
  id INTEGER PRIMARY KEY,
  agent_type TEXT NOT NULL, -- 'general-purpose', 'vault-analyzer', etc.
  version TEXT NOT NULL, -- 'v1.0', 'v1.1', etc.
  model_config JSON, -- Agent configuration and prompts
  performance_metrics JSON, -- Success rates, timing, etc.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT, -- 'system' or user_id
  is_active BOOLEAN DEFAULT FALSE,
  parent_version TEXT, -- For branching
  UNIQUE(agent_type, version)
);

-- Session tracking
CREATE TABLE agent_sessions (
  id INTEGER PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  user_id TEXT, -- From ccflare accounts
  agent_type TEXT NOT NULL,
  agent_version TEXT NOT NULL,
  session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
  session_end DATETIME,
  request_count INTEGER DEFAULT 0,
  tools_used JSON, -- Array of tools used in session
  task_description TEXT,
  success_rating INTEGER, -- 1-5 scale
  completion_time_ms INTEGER,
  error_count INTEGER DEFAULT 0,
  FOREIGN KEY (agent_type, agent_version) REFERENCES agent_versions(agent_type, version)
);

-- Detailed feedback collection
CREATE TABLE session_feedback (
  id INTEGER PRIMARY KEY,
  session_id INTEGER REFERENCES agent_sessions(id),
  feedback_type TEXT NOT NULL, -- 'success', 'error', 'user_rating', 'improvement_suggestion'
  feedback_data JSON NOT NULL, -- Structured feedback content
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  source TEXT DEFAULT 'user' -- 'user', 'system', 'llm_reviewer'
);

-- LLM review system
CREATE TABLE performance_reviews (
  id INTEGER PRIMARY KEY,
  agent_type TEXT NOT NULL,
  current_version TEXT NOT NULL,
  review_period_start DATETIME,
  review_period_end DATETIME,
  sessions_analyzed INTEGER,
  review_summary JSON, -- LLM analysis results
  suggested_improvements JSON,
  new_version_proposed TEXT,
  user_response TEXT, -- 'accepted', 'rejected', 'pending'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User preferences
CREATE TABLE user_agent_preferences (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id INTEGER REFERENCES projects(id),
  agent_type TEXT NOT NULL,
  preferred_version TEXT,
  review_cadence TEXT DEFAULT 'weekly', -- 'daily', 'weekly', 'monthly', 'manual'
  auto_update BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, project_id, agent_type)
);
```

## UI/UX Extensions

### TUI (Terminal Interface)
- **New Projects Screen**: Add to sidebar in `apps/tui/src/App.tsx`
  - Project list with activity indicators
  - Agent version status per project
  - Performance metrics overview
  - Quick actions (review schedule, version management)

### Web Dashboard
- **Projects Page**: Rich web interface for project management
  - Visual performance graphs and trends
  - Agent version comparison charts
  - Feedback timeline and history
  - Bulk operations and settings management

### Desktop App
- **System Integration**: Native notifications for review completion
- **Tray Menu**: Quick access to agent status and updates
- **File System Watching**: Real-time project discovery

## API Extensions

### New Endpoints (apps/server/src/server.ts)
```typescript
// Project management
GET    /api/projects              // List all tracked projects
GET    /api/projects/:id          // Get project details
POST   /api/projects/:id/feedback // Submit project feedback
GET    /api/projects/:id/sessions // Get project session history

// Agent version management
GET    /api/agents/versions       // List all agent versions
POST   /api/agents/versions       // Create new agent version
PUT    /api/agents/versions/:id   // Update agent version
DELETE /api/agents/versions/:id   // Rollback agent version

// Performance reviews
GET    /api/reviews               // List pending reviews
POST   /api/reviews/trigger       // Manually trigger review
PUT    /api/reviews/:id/response  // Accept/reject review suggestions

// Feedback collection
POST   /api/feedback              // Submit general feedback
GET    /api/feedback/summary      // Get feedback analytics
```

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
1. Database schema implementation
2. Project discovery system (.claude file scanning)
3. Basic session logging middleware
4. Projects screen in TUI

### Phase 2: Feedback Collection (Weeks 3-4)
1. Session tracking integration with proxy
2. Feedback collection endpoints
3. Basic performance metrics calculation
4. Web dashboard projects page

### Phase 3: LLM Review System (Weeks 5-6)
1. LLM reviewer implementation
2. Performance analysis algorithms
3. Version generation system
4. Review scheduling and notifications

### Phase 4: Version Management (Weeks 7-8)
1. Agent version control system
2. Rollback mechanisms
3. A/B testing framework
4. User preference management

### Phase 5: Polish & Optimization (Weeks 9-10)
1. UI/UX improvements
2. Performance optimization
3. Documentation and testing
4. Deployment automation

## Sub-Agents Specifications

### 1. Project Discovery Agent
**Purpose**: Scan filesystem for Claude Code projects and maintain project registry
**Tools**: File system access, database operations
**Responsibilities**:
- Recursive .claude file discovery
- Project metadata extraction
- Activity monitoring and updates
- Project lifecycle management

### 2. Session Analytics Agent  
**Purpose**: Analyze agent session data and extract performance insights
**Tools**: Database queries, statistical analysis, data processing
**Responsibilities**:
- Session data aggregation and analysis
- Performance metric calculation
- Trend identification and reporting
- Anomaly detection in agent behavior

### 3. LLM Performance Reviewer Agent
**Purpose**: Conduct comprehensive performance reviews and suggest improvements
**Tools**: LLM access, data analysis, pattern recognition
**Responsibilities**:
- Multi-session performance analysis
- Improvement opportunity identification
- New agent version specification generation
- Review report creation and user communication

### 4. Version Management Agent
**Purpose**: Handle agent version control, deployment, and rollback operations
**Tools**: Database operations, configuration management, deployment systems
**Responsibilities**:
- Version creation and tracking
- Deployment orchestration
- Rollback execution
- Branch management for custom versions

### 5. Feedback Aggregation Agent
**Purpose**: Collect, process, and synthesize user feedback across all touchpoints
**Tools**: Data processing, sentiment analysis, pattern recognition
**Responsibilities**:
- Multi-source feedback collection
- Feedback categorization and prioritization
- User satisfaction tracking
- Recommendation generation for improvements

## Configuration Management

### Environment Variables
```bash
# Feedback system configuration
FEEDBACK_ENABLED=true
PROJECT_DISCOVERY_INTERVAL=3600000  # 1 hour in ms
LLM_REVIEW_MODEL=claude-3-sonnet
DEFAULT_REVIEW_CADENCE=weekly
AUTO_UPDATE_AGENTS=false

# Database configuration
FEEDBACK_DB_PATH=./data/feedback.db
FEEDBACK_RETENTION_DAYS=365

# LLM reviewer configuration
REVIEWER_TEMPERATURE=0.1
REVIEWER_MAX_TOKENS=4096
REVIEWER_TIMEOUT_MS=30000
```

### User Configuration (CLAUDE.md extension)
```markdown
## Agent Feedback System

### Project Settings
- Review cadence: weekly (daily/weekly/monthly/manual)
- Auto-update agents: false
- Preferred agent versions:
  - general-purpose: v1.2
  - vault-analyzer: v2.1
  - research-specialist: v1.5

### Feedback Preferences
- Collect implicit feedback: true
- Show performance notifications: true
- Participate in A/B testing: true
```

## Success Metrics

### Technical Metrics
- **Agent Performance**: Task completion rates, error reduction, response times
- **User Satisfaction**: Feedback ratings, version adoption rates, rollback frequency
- **System Performance**: Processing latency, storage efficiency, scalability metrics

### Business Metrics
- **User Engagement**: Session frequency, feature adoption, retention rates
- **Improvement Velocity**: Time from feedback to deployment, version iteration speed
- **Quality Metrics**: Bug reduction, user-reported issues, support ticket volume

## Security & Privacy Considerations

### Data Protection
- **Local Storage**: All feedback data stored locally in user's ccflare instance
- **Sensitive Data**: No code content stored, only metadata and performance metrics
- **User Control**: Complete data ownership with export/delete capabilities
- **Anonymization**: Optional anonymous feedback submission for system improvements

### Access Control
- **Project Isolation**: Feedback data segregated by project and user
- **Permission Management**: Integration with ccflare's existing account system
- **Audit Logging**: Track all system modifications and access patterns

## Future Enhancements

### Advanced Analytics
- **Predictive Modeling**: Anticipate user needs and proactively suggest improvements
- **Cross-Project Learning**: Share insights across similar project types
- **Collaborative Filtering**: Recommend agent versions based on similar user patterns

### Integration Opportunities
- **IDE Plugins**: Direct feedback collection from development environments
- **CI/CD Integration**: Automated performance testing and deployment
- **Team Collaboration**: Shared agent configurations and feedback across teams

---

## Getting Started

Once implemented, users can enable the feedback system by:

1. **Enable in Configuration**: Set `FEEDBACK_ENABLED=true` in ccflare config
2. **Configure Preferences**: Set review cadence and agent preferences in CLAUDE.md
3. **Access Projects Page**: Use TUI or web dashboard to view tracked projects
4. **Provide Feedback**: Rate sessions and provide improvement suggestions
5. **Manage Versions**: Test new agent versions and rollback if needed

The system operates transparently, requiring minimal user intervention while providing powerful tools for those who want fine-grained control over their AI agent experience.