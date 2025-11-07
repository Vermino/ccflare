# Sub-Agents Specifications for Agent Feedback System

This document provides detailed specifications for the specialized sub-agents required to implement the Agent Feedback System in ccflare. Each agent follows Claude Code's sub-agent architecture patterns.

## Agent Architecture Reference

Based on [Claude Code Sub-Agents Documentation](https://docs.anthropic.com/en/docs/claude-code/sub-agents), each agent should:
- Have a clear, focused responsibility
- Use appropriate tools for their domain
- Follow the established agent communication patterns
- Be stateless and autonomous
- Return comprehensive results in their final message

## 1. Project Discovery Agent

### Agent Type: `project-discovery`

### Description
Specialized agent for discovering Claude Code projects by scanning for .claude files, extracting project metadata, and maintaining the project registry. Monitors filesystem changes and updates project activity status.

### Tools Available
- `repl` (for file system operations and data processing)
- File system access functions
- Database operations

### Responsibilities
```markdown
#### Primary Functions
1. **Recursive Project Scanning**
   - Scan specified directories for .claude files
   - Extract project metadata (name, path, creation date)
   - Identify project types and configurations
   - Track project directory structure

2. **Project Registry Management**
   - Maintain SQLite database of discovered projects
   - Update project last activity timestamps
   - Track project lifecycle events
   - Handle project moves/deletions

3. **Activity Monitoring**
   - Monitor file system changes in project directories
   - Detect new .claude files and projects
   - Update activity status based on file modifications
   - Generate project health reports

4. **Metadata Extraction**
   - Parse .claude file contents for project settings
   - Extract agent preferences and configurations
   - Identify project dependencies and requirements
   - Catalog project documentation and structure
```

### Usage Patterns
```typescript
// Example usage
const agent = await launchAgent('project-discovery', {
  description: "Scan for Claude projects",
  prompt: `
    Scan the user's filesystem starting from these directories: ${scanPaths}
    
    Tasks:
    1. Find all .claude files recursively
    2. Extract project metadata from each discovered project
    3. Update the project registry database
    4. Return a summary of discovered/updated projects
    
    Database schema: ${projectSchema}
    
    Return format:
    {
      "discovered": number,
      "updated": number,
      "projects": [{
        "name": string,
        "path": string,
        "lastActivity": string,
        "metadata": object
      }]
    }
  `
});
```

### Expected Output Format
```json
{
  "summary": {
    "projectsDiscovered": 15,
    "projectsUpdated": 3,
    "scanDurationMs": 2500
  },
  "projects": [
    {
      "id": "proj_001",
      "name": "my-web-app",
      "path": "/Users/dev/projects/my-web-app",
      "claudeFilePath": "/Users/dev/projects/my-web-app/.claude",
      "lastActivity": "2024-01-15T14:30:00Z",
      "metadata": {
        "projectType": "web",
        "agents": ["general-purpose", "documentation-writer"],
        "dependencies": ["react", "typescript"]
      }
    }
  ],
  "errors": []
}
```

## 2. Session Analytics Agent

### Agent Type: `session-analytics`

### Description
Expert analytics agent that processes agent session data, calculates performance metrics, identifies trends, and generates insights for the LLM Performance Reviewer. Specializes in statistical analysis of agent behavior patterns.

### Tools Available
- `repl` (for data analysis and calculations)
- Database query operations
- Statistical analysis functions

### Responsibilities
```markdown
#### Primary Functions
1. **Session Data Aggregation**
   - Query session data across time periods
   - Aggregate metrics by agent type, project, and user
   - Calculate performance baselines and trends
   - Generate comparative analysis reports

2. **Performance Metric Calculation**
   - Task completion rates and success percentages
   - Average session duration and efficiency metrics
   - Error frequency and categorization
   - User satisfaction scoring and trends

3. **Trend Identification**
   - Identify performance improvements or degradations
   - Detect seasonal patterns in agent usage
   - Flag anomalous behavior or performance drops
   - Track user preference evolution over time

4. **Insight Generation**
   - Correlate performance with project characteristics
   - Identify high-performing agent configurations
   - Generate recommendations for optimization
   - Prepare data summaries for LLM review
```

### Usage Patterns
```typescript
const agent = await launchAgent('session-analytics', {
  description: "Analyze agent performance",
  prompt: `
    Analyze agent session performance for the following criteria:
    - Agent type: ${agentType}
    - Time period: ${startDate} to ${endDate}
    - Project scope: ${projectIds}
    
    Calculate:
    1. Success rate trends over time
    2. Average completion times
    3. Error patterns and frequency
    4. User satisfaction metrics
    5. Performance comparison with previous period
    
    Database tables: ${sessionTables}
    
    Generate insights and recommendations for improvement.
    Return detailed analysis with actionable recommendations.
  `
});
```

### Expected Output Format
```json
{
  "analysisMetadata": {
    "agentType": "general-purpose",
    "periodAnalyzed": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-31T23:59:59Z"
    },
    "sessionsAnalyzed": 1250,
    "projectsIncluded": 15
  },
  "performanceMetrics": {
    "successRate": {
      "current": 0.85,
      "previous": 0.78,
      "trend": "improving"
    },
    "averageCompletionTime": {
      "current": 45000,
      "previous": 52000,
      "trend": "improving"
    },
    "errorRate": {
      "current": 0.12,
      "previous": 0.18,
      "trend": "improving"
    },
    "userSatisfaction": {
      "average": 4.2,
      "distribution": [0, 2, 5, 15, 78],
      "trend": "stable"
    }
  },
  "insights": [
    {
      "type": "performance_improvement",
      "description": "Code generation tasks show 15% faster completion",
      "confidence": 0.92,
      "recommendation": "Optimize prompts for similar task patterns"
    }
  ],
  "recommendations": [
    "Focus on error handling improvement for debugging tasks",
    "Consider specialized prompts for TypeScript projects"
  ]
}
```

## 3. LLM Performance Reviewer Agent

### Agent Type: `llm-performance-reviewer`

### Description
Senior analyst agent that conducts comprehensive performance reviews using LLM capabilities. Analyzes aggregated session data, generates improvement strategies, and creates new agent version specifications.

### Tools Available
- `repl` (for data processing and analysis)
- LLM access for advanced reasoning
- Agent configuration templating

### Responsibilities
```markdown
#### Primary Functions
1. **Comprehensive Performance Analysis**
   - Review multi-session performance patterns
   - Analyze user feedback sentiment and trends
   - Identify systematic improvement opportunities
   - Evaluate agent behavior consistency

2. **Improvement Strategy Generation**
   - Design targeted improvements based on data
   - Create new prompt strategies and configurations
   - Suggest tool usage optimizations
   - Develop specialized behavior patterns

3. **Agent Version Specification**
   - Generate detailed specifications for new versions
   - Define configuration changes and improvements
   - Create upgrade migration strategies
   - Document expected performance improvements

4. **Review Report Creation**
   - Synthesize findings into actionable reports
   - Provide clear improvement rationale
   - Generate user-friendly change summaries
   - Create technical implementation details
```

### Usage Patterns
```typescript
const agent = await launchAgent('llm-performance-reviewer', {
  description: "Generate performance review",
  prompt: `
    Conduct a comprehensive performance review for agent: ${agentType}
    
    Analysis inputs:
    - Session analytics: ${analyticsData}
    - User feedback: ${feedbackSummary}
    - Current agent configuration: ${currentConfig}
    - Performance benchmarks: ${benchmarks}
    
    Tasks:
    1. Analyze performance patterns and identify improvement areas
    2. Generate specific recommendations for agent enhancement
    3. Create new agent version specification with improvements
    4. Provide user-friendly summary of proposed changes
    5. Estimate expected performance improvements
    
    Focus on:
    - Task completion efficiency
    - Error reduction strategies
    - User satisfaction improvements
    - Code quality enhancements
    
    Return comprehensive review with actionable next steps.
  `
});
```

### Expected Output Format
```json
{
  "reviewMetadata": {
    "agentType": "general-purpose",
    "currentVersion": "v1.1",
    "proposedVersion": "v1.2",
    "reviewDate": "2024-01-31T10:00:00Z",
    "dataAnalyzed": {
      "sessions": 1250,
      "projects": 15,
      "timeSpan": "30 days"
    }
  },
  "performanceAnalysis": {
    "strengths": [
      "Excellent code generation for React components",
      "Strong error handling in debugging scenarios",
      "Consistent documentation quality"
    ],
    "improvementAreas": [
      "TypeScript type inference could be more precise",
      "Test generation needs better edge case coverage",
      "File organization suggestions need refinement"
    ],
    "keyFindings": [
      {
        "area": "Code Quality",
        "finding": "Generated code follows best practices 89% of the time",
        "improvement": "Enhance linting integration for remaining 11%"
      }
    ]
  },
  "proposedImprovements": {
    "promptEnhancements": [
      "Add TypeScript-specific reasoning patterns",
      "Include edge case consideration prompts for testing",
      "Enhance code organization decision trees"
    ],
    "behaviorChanges": [
      "Proactively suggest performance optimizations",
      "Include accessibility considerations in UI components",
      "Offer alternative implementation approaches"
    ],
    "toolUsageOptimizations": [
      "Batch file operations more efficiently",
      "Improve error recovery strategies",
      "Enhance context preservation across sessions"
    ]
  },
  "newVersionSpec": {
    "version": "v1.2",
    "changes": {
      "prompts": {
        "codeGeneration": "Enhanced with TypeScript-specific patterns...",
        "testing": "Added edge case consideration framework...",
        "organization": "Improved file structure decision logic..."
      },
      "behavior": {
        "proactiveness": "Increased for performance suggestions",
        "accessibility": "Added WCAG compliance checks",
        "alternatives": "Offer 2-3 implementation options when relevant"
      }
    },
    "expectedImprovements": {
      "codeQuality": "+8%",
      "testCoverage": "+15%",
      "userSatisfaction": "+12%",
      "taskCompletionTime": "-5%"
    }
  },
  "userSummary": {
    "title": "Agent v1.2 Ready: Enhanced TypeScript & Testing",
    "description": "Your general-purpose agent has been upgraded with better TypeScript support, improved test generation, and smarter code organization. Expected improvements: 8% better code quality, 15% better test coverage.",
    "breakingChanges": false,
    "recommendedAction": "Try the new version on your next TypeScript project"
  }
}
```

## 4. Version Management Agent

### Agent Type: `version-management`

### Description
Infrastructure agent responsible for agent version control, deployment orchestration, rollback operations, and branch management. Handles the technical aspects of agent version lifecycle management.

### Tools Available
- `repl` (for configuration management)
- Database operations
- Configuration deployment systems

### Responsibilities
```markdown
#### Primary Functions
1. **Version Control Operations**
   - Create new agent versions from specifications
   - Track version history and relationships
   - Manage version metadata and configurations
   - Handle version branching and merging

2. **Deployment Orchestration**
   - Deploy new agent versions to production
   - Manage gradual rollout strategies
   - Coordinate A/B testing deployments
   - Handle configuration updates and validation

3. **Rollback Management**
   - Execute safe rollbacks to previous versions
   - Preserve user data during version changes
   - Manage rollback validation and testing
   - Handle emergency rollback scenarios

4. **Branch Management**
   - Create custom version branches for users
   - Manage parallel version development
   - Handle version merging and conflict resolution
   - Maintain branch genealogy and relationships
```

### Usage Patterns
```typescript
const agent = await launchAgent('version-management', {
  description: "Deploy new agent version",
  prompt: `
    Deploy new agent version based on this specification:
    ${versionSpec}
    
    Deployment requirements:
    - Agent type: ${agentType}
    - Source version: ${sourceVersion}
    - Target version: ${targetVersion}
    - User scope: ${userScope}
    - Rollout strategy: ${rolloutStrategy}
    
    Tasks:
    1. Validate version specification completeness
    2. Create version record in database
    3. Deploy configuration to appropriate scope
    4. Set up monitoring and validation
    5. Prepare rollback plan
    
    Ensure:
    - No breaking changes to user workflows
    - Proper fallback mechanisms
    - Comprehensive logging for troubleshooting
    
    Return deployment status and rollback instructions.
  `
});
```

### Expected Output Format
```json
{
  "deploymentMetadata": {
    "agentType": "general-purpose",
    "sourceVersion": "v1.1",
    "targetVersion": "v1.2",
    "deploymentId": "deploy_20240131_001",
    "strategy": "gradual_rollout",
    "timestamp": "2024-01-31T15:30:00Z"
  },
  "deploymentStatus": {
    "status": "success",
    "validationsPassed": 15,
    "validationsFailed": 0,
    "deploymentDuration": 2500,
    "usersAffected": 1
  },
  "versionDetails": {
    "version": "v1.2",
    "configurationChanges": [
      "Enhanced TypeScript prompts",
      "Improved test generation logic",
      "Added accessibility considerations"
    ],
    "behaviorChanges": [
      "More proactive performance suggestions",
      "Alternative implementation options",
      "Better error recovery"
    ]
  },
  "rollbackPlan": {
    "rollbackVersion": "v1.1",
    "rollbackCommand": "rollback-agent general-purpose v1.1 --user user123",
    "estimatedRollbackTime": 30,
    "dataPreservation": "All user preferences and session data preserved"
  },
  "monitoring": {
    "enabled": true,
    "metrics": ["success_rate", "completion_time", "error_rate", "user_satisfaction"],
    "alertThresholds": {
      "success_rate_drop": 0.05,
      "error_rate_increase": 0.1
    }
  },
  "nextSteps": [
    "Monitor performance metrics for 24 hours",
    "Collect user feedback on new version",
    "Prepare for wider rollout if metrics are positive"
  ]
}
```

## 5. Feedback Aggregation Agent

### Agent Type: `feedback-aggregation`

### Description
Data processing specialist that collects, processes, and synthesizes user feedback from multiple sources. Specializes in sentiment analysis, pattern recognition, and feedback categorization for system improvements.

### Tools Available
- `repl` (for data processing and analysis)
- Text analysis and sentiment processing
- Database operations for feedback storage

### Responsibilities
```markdown
#### Primary Functions
1. **Multi-Source Feedback Collection**
   - Aggregate feedback from sessions, surveys, and implicit signals
   - Process real-time feedback during agent interactions
   - Collect system-generated performance feedback
   - Harvest feedback from user interface interactions

2. **Feedback Processing and Analysis**
   - Categorize feedback by type, severity, and domain
   - Perform sentiment analysis on textual feedback
   - Identify recurring themes and patterns
   - Correlate feedback with performance metrics

3. **User Satisfaction Tracking**
   - Calculate satisfaction scores and trends
   - Track satisfaction by project type and agent version
   - Identify satisfaction drivers and detractors
   - Generate satisfaction prediction models

4. **Recommendation Generation**
   - Synthesize feedback into actionable recommendations
   - Prioritize improvements based on feedback frequency
   - Generate user-specific improvement suggestions
   - Create system-wide enhancement priorities
```

### Usage Patterns
```typescript
const agent = await launchAgent('feedback-aggregation', {
  description: "Process user feedback",
  prompt: `
    Process and analyze user feedback for the following scope:
    - Time period: ${startDate} to ${endDate}
    - Agent types: ${agentTypes}
    - Projects: ${projectIds}
    - Feedback sources: ${feedbackSources}
    
    Feedback data includes:
    ${feedbackData}
    
    Tasks:
    1. Categorize all feedback by type and severity
    2. Perform sentiment analysis on textual feedback
    3. Identify top 10 most common user concerns
    4. Generate satisfaction trends and correlations
    5. Create prioritized improvement recommendations
    
    Focus on:
    - User pain points and frustrations
    - Positive feedback patterns worth reinforcing
    - Feature requests and enhancement ideas
    - Performance and reliability concerns
    
    Return comprehensive feedback analysis with actionable insights.
  `
});
```

### Expected Output Format
```json
{
  "aggregationMetadata": {
    "periodAnalyzed": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-31T23:59:59Z"
    },
    "feedbackItemsProcessed": 2847,
    "sourcesIncluded": ["sessions", "surveys", "implicit", "ui_interactions"],
    "agentTypesAnalyzed": ["general-purpose", "vault-analyzer", "research-specialist"]
  },
  "feedbackCategories": {
    "performance": {
      "count": 892,
      "averageSentiment": 0.65,
      "topConcerns": [
        "Response time for large codebases",
        "Memory usage during complex operations",
        "Tool selection efficiency"
      ]
    },
    "usability": {
      "count": 1235,
      "averageSentiment": 0.78,
      "topConcerns": [
        "Learning curve for new users",
        "Documentation clarity",
        "Error message helpfulness"
      ]
    },
    "features": {
      "count": 720,
      "averageSentiment": 0.72,
      "topRequests": [
        "Better TypeScript support",
        "Integrated testing workflows",
        "Custom template creation"
      ]
    }
  },
  "sentimentAnalysis": {
    "overall": {
      "score": 0.74,
      "trend": "improving",
      "distribution": {
        "very_positive": 0.28,
        "positive": 0.42,
        "neutral": 0.20,
        "negative": 0.08,
        "very_negative": 0.02
      }
    },
    "byAgentType": {
      "general-purpose": 0.76,
      "vault-analyzer": 0.81,
      "research-specialist": 0.69
    }
  },
  "topIssues": [
    {
      "issue": "Code generation speed for large files",
      "frequency": 234,
      "severity": "medium",
      "sentiment": -0.3,
      "affectedUsers": 156,
      "suggestedAction": "Optimize file processing algorithms"
    }
  ],
  "satisfactionMetrics": {
    "overallSatisfaction": 4.1,
    "npsScore": 67,
    "retentionCorrelation": 0.89,
    "satisfactionDrivers": [
      "Code quality accuracy",
      "Error handling",
      "Documentation generation"
    ]
  },
  "recommendations": {
    "immediate": [
      "Improve TypeScript type inference accuracy",
      "Enhance error message clarity and actionability",
      "Optimize large file processing performance"
    ],
    "shortTerm": [
      "Develop integrated testing workflow features",
      "Create user onboarding improvement program",
      "Implement custom template system"
    ],
    "longTerm": [
      "Research advanced code understanding capabilities",
      "Develop predictive user assistance features",
      "Create collaborative development tools"
    ]
  },
  "actionPriorities": [
    {
      "action": "Enhance TypeScript support",
      "priority": 1,
      "impactScore": 8.5,
      "effortEstimate": "medium",
      "affectedUsers": 456
    }
  ]
}
```

## Integration Guidelines

### Agent Communication Patterns
Each agent should follow these communication patterns:

1. **Stateless Operation**: Each agent invocation is independent
2. **Comprehensive Results**: Return all necessary information in final message
3. **Error Handling**: Include error details and recovery suggestions
4. **Structured Output**: Use consistent JSON schemas for easy processing
5. **Performance Logging**: Include timing and resource usage metrics

### Tool Usage Guidelines
- Use `repl` for complex data processing and analysis
- Leverage existing ccflare database connections
- Follow ccflare's logging patterns for consistency
- Respect user privacy and data protection requirements

### Deployment Considerations
- All agents operate within ccflare's security boundary
- Database access should use existing connection pools
- Configuration should integrate with ccflare's config system
- Monitoring should use ccflare's existing observability stack

---

These sub-agents work together to create a comprehensive feedback and improvement system while maintaining ccflare's existing architecture patterns and performance characteristics.