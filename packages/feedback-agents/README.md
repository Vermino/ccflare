# Claude Code Feedback System Agents

This package contains the specialized sub-agents for the Claude Code Agent Feedback System. These agents work together to provide comprehensive feedback collection, analysis, and agent improvement capabilities.

## Agents Overview

### 1. Project Discovery Agent (`project-discovery`)
**Purpose**: Discover and catalog Claude Code projects by scanning for `.claude` files
- Scans filesystem recursively for projects
- Extracts project metadata and configurations
- Maintains project registry in database
- Monitors project activity and updates

### 2. Session Analytics Agent (`session-analytics`)
**Purpose**: Analyze agent session data and calculate performance metrics
- Aggregates session data across time periods
- Calculates performance metrics and trends
- Identifies patterns and anomalies
- Generates insights for performance improvement

### 3. LLM Performance Reviewer (`llm-performance-reviewer`)
**Purpose**: Conduct comprehensive performance reviews and generate improvement strategies
- Analyzes complex performance patterns
- Generates targeted improvement strategies
- Creates detailed agent version specifications
- Provides strategic recommendations

### 4. Version Management Agent (`version-management`)
**Purpose**: Handle agent version control, deployment, and rollback operations
- Manages agent version lifecycle
- Orchestrates safe deployments with rollback capabilities
- Handles A/B testing and gradual rollouts
- Maintains version history and relationships

### 5. Feedback Aggregation Agent (`feedback-aggregation`)
**Purpose**: Collect, process, and synthesize user feedback from multiple sources
- Aggregates feedback from sessions, surveys, and user interactions
- Performs sentiment analysis and pattern recognition
- Generates satisfaction metrics and trends
- Creates actionable improvement recommendations

## Installation

To deploy these agents to your Claude Code global agents directory:

```bash
# Copy agents to global directory
cp packages/feedback-agents/agents/* ~/.claude/agents/

# Or use the deployment script (if available)
bun run deploy-feedback-agents
```

## Usage

These agents are designed to be invoked by the feedback system automatically, but can also be called manually:

```typescript
// Example: Discover projects
const projectAgent = await launchAgent('project-discovery', {
  description: "Scan for projects",
  prompt: `
    Scan the following directories for Claude Code projects:
    - /Users/dev/projects
    - /Users/dev/workspace
    
    Update the project registry and return a summary of discovered projects.
  `
});

// Example: Analyze session performance
const analyticsAgent = await launchAgent('session-analytics', {
  description: "Analyze performance",
  prompt: `
    Analyze agent performance for general-purpose agent
    from 2024-01-01 to 2024-01-31.
    
    Calculate success rates, completion times, and error patterns.
    Generate insights and recommendations.
  `
});
```

## Database Schema

The agents use the extended database schema defined in `packages/database/src/migrations.ts`:

- `projects` - Project registry and metadata
- `agent_versions` - Agent version management  
- `agent_sessions` - Session tracking and metrics
- `session_feedback` - Detailed feedback collection
- `performance_reviews` - LLM review results
- `user_agent_preferences` - User preferences and settings

## Configuration

The feedback system can be configured via environment variables:

```bash
FEEDBACK_ENABLED=true
PROJECT_DISCOVERY_INTERVAL=3600000  # 1 hour
LLM_REVIEW_MODEL=claude-3-sonnet
DEFAULT_REVIEW_CADENCE=weekly
AUTO_UPDATE_AGENTS=false
```

## Agent Communication Flow

1. **Project Discovery** → Scans filesystem and updates project registry
2. **Session Analytics** → Analyzes session data and generates performance metrics  
3. **Feedback Aggregation** → Processes user feedback and sentiment
4. **LLM Performance Reviewer** → Reviews data and creates improvement specifications
5. **Version Management** → Deploys new agent versions and manages rollbacks

## Development

Each agent follows the Claude Code sub-agent specification:
- Markdown files with frontmatter configuration
- Autonomous operation with comprehensive output
- Structured JSON response format
- Error handling and validation
- Performance logging and metrics

## Security & Privacy

- All data stored locally in user's ccflare instance
- No code content stored, only metadata and metrics
- User maintains complete control over data
- Optional anonymous feedback submission
- Audit logging for all operations

## Monitoring

The agents include comprehensive monitoring and observability:
- Performance metrics and timing
- Error rates and failure modes
- User satisfaction tracking
- System health indicators
- Deployment success metrics

For more details, see the main [Agent Feedback System documentation](../../AGENT_FEEDBACK_SYSTEM.md).