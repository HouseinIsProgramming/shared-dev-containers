# Project Use Case Report: shared-dev-containers (sdc)

**Report Date:** January 18, 2026
**Feature ID:** feature-1768711277819-a1a8ug8ke
**Report Type:** Use Case Verification & Project Analysis

---

## Executive Summary

**shared-dev-containers (sdc)** is a CLI tool designed to solve the problem of managing consistent development container configurations across multiple projects while still allowing per-project customization. The project successfully addresses the core use case of enabling teams to share base devcontainer templates while permitting individual developers and projects to extend them with their specific needs.

---

## Primary Use Case

### Problem Statement
Developers working across multiple projects often need:
1. **Consistent development environments** - Same base tools, shell configurations, and extensions across projects
2. **Project-specific customizations** - Different dependencies, ports, and configurations per project
3. **Easy updates** - When base templates change, updates should propagate to all projects
4. **Team collaboration** - Shared configurations that can be distributed via Git repositories

### Solution Provided
The `sdc` tool provides a hierarchical configuration system:

```
Global Templates (shared)
         ↓
    Base Template (e.g., node, python, bun)
         ↓
    Project Config (sdc.json - project-specific overrides)
         ↓
    Final devcontainer.json (merged output)
```

---

## Core Capabilities Verified

### 1. Template Management
| Feature | Status | Description |
|---------|--------|-------------|
| Built-in Templates | ✅ Implemented | base, node, bun, python, claude-zsh |
| Custom Templates | ✅ Implemented | Create, list, get, delete operations |
| Remote Repositories | ✅ Implemented | Git-based template distribution with SSH/token auth |
| Template Sync | ✅ Implemented | Auto-sync and manual sync from remote repos |

### 2. Project Configuration
| Feature | Status | Description |
|---------|--------|-------------|
| Project Init | ✅ Implemented | Initialize with --global, --name, --template, --auto |
| Auto-detection | ✅ Implemented | Detects Node, Python, Bun, Go, Rust, Java, .NET, Ruby, PHP |
| Framework Detection | ✅ Implemented | Next.js, React, Vue, Angular, Express, Django, Flask, FastAPI, etc. |
| Config Merging | ✅ Implemented | Deep merge of base template + project overrides |

### 3. Update & Sync Operations
| Feature | Status | Description |
|---------|--------|-------------|
| Project Update | ✅ Implemented | Regenerate devcontainer.json from template + config |
| Dry Run Mode | ✅ Implemented | Preview changes before applying |
| Bulk Sync | ✅ Implemented | Sync all projects in a directory |
| Conflict Detection | ✅ Implemented | Identify version, environment, port, extension conflicts |

### 4. User Experience
| Feature | Status | Description |
|---------|--------|-------------|
| Interactive Wizard | ✅ Implemented | Guided setup for new users |
| Quick Wizard | ✅ Implemented | Minimal prompts mode |
| Project Scaffolding | ✅ Implemented | Create new projects with full setup |
| Customizations | ✅ Implemented | Dotfiles, shell config, env vars |

---

## Technical Architecture

### Technology Stack
- **Runtime:** Bun (primary) / Node.js 22+ (compatible)
- **Language:** TypeScript
- **Build:** Bun bundler / TypeScript compiler
- **Testing:** Playwright (configured but tests directory empty)

### Project Structure
```
src/
├── cli.ts              # Main CLI entry point (816 lines)
├── index.ts            # Library exports
├── commands/           # Command implementations
│   ├── init.ts         # Initialize configurations
│   ├── scaffold.ts     # Create new projects
│   ├── sync.ts         # Sync projects to templates
│   ├── template.ts     # Manage local templates
│   ├── repo-template.ts # Manage remote repositories
│   ├── wizard.ts       # Interactive setup
│   ├── customize.ts    # User customizations
│   └── validate.ts     # Configuration validation
├── utils/              # Utility functions
│   ├── analyzer.ts     # Project type detection (680 lines)
│   ├── config.ts       # Configuration management
│   ├── conflict-detector.ts # Conflict detection
│   ├── diff.ts         # Diff generation
│   ├── git.ts          # Git operations
│   ├── merge.ts        # Config merging
│   └── prompts.ts      # User prompts
├── templates/          # Built-in template definitions
│   ├── base.json
│   ├── node.json
│   ├── bun.json
│   ├── python.json
│   └── claude-zsh.json
└── types/
    └── index.ts        # TypeScript type definitions (331 lines)
```

### Key Type Definitions
- `DevcontainerConfig` - Standard devcontainer.json structure
- `ProjectConfig` - Project-specific customizations (sdc.json)
- `GlobalConfig` - Global settings and templates directory
- `GitTemplateSource` - Remote Git repository configuration
- `ProjectAnalysis` - Results of project auto-detection
- `ConflictDetectionResult` - Conflict analysis results

---

## Built-in Templates Analysis

### 1. base.json
- **Image:** `mcr.microsoft.com/devcontainers/base:ubuntu`
- **Features:** zsh, git, GitHub CLI, Docker-in-Docker
- **Use Case:** General-purpose development

### 2. node.json
- **Image:** `mcr.microsoft.com/devcontainers/javascript-node:22`
- **Features:** Node.js 22, npm, common web dev tools
- **Ports:** 3000, 5173, 8080
- **Use Case:** Node.js/JavaScript development

### 3. bun.json
- **Use Case:** Bun runtime development

### 4. python.json
- **Use Case:** Python development (Django, Flask, FastAPI)

### 5. claude-zsh.json
- **Image:** `mcr.microsoft.com/devcontainers/base:ubuntu`
- **Features:** zsh4humans, Claude Code, Docker-in-Docker, Node.js 22
- **Special:** Installs Claude Code CLI, configures ANTHROPIC_API_KEY
- **Use Case:** AI-assisted development with Claude

---

## Framework Detection Capabilities

The analyzer (`src/utils/analyzer.ts`) supports detection of:

### JavaScript/TypeScript
- Next.js, React, Vue.js, Angular
- Express, NestJS
- Vite, Tailwind CSS
- Jest, Vitest, Playwright

### Python
- Django, Flask, FastAPI
- pytest

### Go
- Gin, Echo, Fiber

### Other (basic detection)
- Rust (Cargo projects)
- Java (Maven/Gradle)
- .NET (C#/F#)
- Ruby (Rails, Gemfile)
- PHP (Composer)

---

## Command Reference

| Command | Description |
|---------|-------------|
| `sdc wizard` | Interactive setup wizard |
| `sdc init --global` | Initialize global configuration |
| `sdc init --auto` | Auto-detect and initialize project |
| `sdc update` | Update devcontainer.json from templates |
| `sdc update --dry-run` | Preview update changes |
| `sdc template list` | List available templates |
| `sdc repo add <name> <url>` | Add remote template repository |
| `sdc repo sync` | Sync remote repositories |
| `sdc sync` | Sync all projects in directory |
| `sdc scaffold <dir>` | Create new project with setup |
| `sdc customize dotfiles <url>` | Configure dotfiles repo |
| `sdc customize env <name> <value>` | Set environment variable |

---

## Use Case Scenarios

### Scenario 1: Team Onboarding
```bash
# New team member sets up their environment
sdc init --global
sdc customize dotfiles https://github.com/user/dotfiles.git
sdc repo add company https://github.com/company/devcontainer-templates.git
sdc repo sync
```

### Scenario 2: New Project Setup
```bash
# Create a new Node.js project
sdc scaffold ./my-app --template node --name my-app

# Or with auto-detection on existing project
cd existing-project
sdc init --auto
```

### Scenario 3: Template Updates
```bash
# Check which projects need updating
sdc sync check ~/projects

# Preview changes
sdc sync ~/projects --dry-run

# Apply updates
sdc sync ~/projects
```

### Scenario 4: Project-Specific Customization
Edit `.devcontainer/sdc.json`:
```json
{
  "name": "my-project",
  "extends": "node",
  "features": {
    "ghcr.io/devcontainers/features/aws-cli:1": {}
  },
  "ports": [4000],
  "postCreateCommands": ["npm run setup"]
}
```
Then: `sdc update`

---

## Assessment & Recommendations

### Strengths
1. **Comprehensive feature set** - Covers full lifecycle of devcontainer management
2. **Good type safety** - Well-defined TypeScript interfaces
3. **Flexible architecture** - Supports local and remote templates
4. **Smart detection** - Framework auto-detection reduces manual configuration
5. **Conflict handling** - Built-in conflict detection and resolution suggestions

### Areas for Improvement
1. **Testing** - The `tests/` directory is empty; Playwright tests should be added
2. **Documentation** - README is comprehensive but could use more examples
3. **Error handling** - Some edge cases may need better error messages
4. **Template variety** - Could add more built-in templates (Go, Rust, Java)

### Suggested Enhancements
1. Add unit and integration tests
2. Implement template versioning
3. Add template inheritance chains (template extends template)
4. Provide migration tools for existing devcontainer setups
5. Add GUI/web interface for non-CLI users

---

## Conclusion

The **shared-dev-containers** project successfully fulfills its stated use case of providing developers with preconfigured devcontainers per project while maintaining customization flexibility. The implementation is well-structured, uses modern TypeScript practices, and provides a comprehensive CLI interface for all major operations.

The tool addresses the key requirements outlined in the original specification:
- ✅ Preconfigured devcontainers per project
- ✅ Customization support
- ✅ Template updates propagate to projects
- ✅ Base container cloning with project-specific modifications
- ✅ Claude Code and zsh4humans integration (via claude-zsh template)
- ✅ Executable CLI tool

---

*Report generated as part of Feature ID: feature-1768711277819-a1a8ug8ke*
