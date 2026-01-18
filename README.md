# shared-dev-containers (sdc)

A powerful CLI tool for managing preconfigured devcontainer configurations across multiple projects. Define shared base templates while allowing individual projects to customize them for their specific needs.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands](#commands)
  - [init](#sdc-init)
  - [update](#sdc-update)
  - [template](#sdc-template)
  - [repo-template](#sdc-repo-template)
  - [sync](#sdc-sync)
  - [scaffold](#sdc-scaffold)
  - [wizard](#sdc-wizard)
- [Built-in Templates](#built-in-templates)
- [Configuration](#configuration)
- [How It Works](#how-it-works)
- [Advanced Features](#advanced-features)
- [Development](#development)
- [License](#license)

## Features

- **Shared Base Templates**: Define common devcontainer configurations that can be used across multiple projects
- **Project Customization**: Each project can extend and customize the base configuration
- **Automatic Merging**: Changes to base templates can be synced to all projects
- **Built-in Templates**: Comes with templates for Node.js, Bun, Python, and a Claude + zsh4humans setup
- **Project Analysis**: Auto-detect project type and recommend appropriate templates
- **Remote Template Repositories**: Fetch and manage templates from Git repositories
- **Conflict Detection**: Identify and resolve configuration conflicts between templates
- **Interactive Wizard**: Guided setup for new users
- **Project Scaffolding**: Create new projects with complete devcontainer setup
- **CLI Tool**: Easy-to-use command line interface for managing devcontainers

## Prerequisites

Before installing, ensure you have one of the following:

- **Node.js** >= 22.0.0
- **Bun** >= 1.0.0 (recommended for better performance)

## Installation

### Using Bun (recommended)

```bash
bun install -g shared-dev-containers
```

### Using npm

```bash
npm install -g shared-dev-containers
```

### Verify Installation

```bash
sdc --version
sdc --help
```

## Quick Start

### 1. Initialize global configuration

```bash
sdc init --global
```

This creates the global configuration directory at `~/.shared-dev-containers/` with default templates.

### 2. Initialize a project

```bash
cd your-project
sdc init --name my-project --template node
```

Or use auto-detection to recommend a template based on your project:

```bash
sdc init --auto
```

This creates a `.devcontainer/` directory with:
- `devcontainer.json` - The merged devcontainer configuration
- `sdc.json` - Project-specific customizations

### 3. Customize your project

Edit `.devcontainer/sdc.json` to add project-specific settings:

```json
{
  "name": "my-project",
  "extends": "node",
  "features": {
    "ghcr.io/devcontainers/features/aws-cli:1": {}
  },
  "extensions": [
    "amazonwebservices.aws-toolkit-vscode"
  ],
  "env": {
    "NODE_ENV": "development"
  },
  "ports": [4000],
  "postCreateCommands": [
    "npm run setup"
  ]
}
```

### 4. Update devcontainer.json

```bash
sdc update
```

This regenerates `devcontainer.json` by merging the base template with your project customizations.

## Commands

### `sdc init`

Initialize shared-dev-containers globally or for a specific project.

```bash
# Initialize global configuration
sdc init --global

# Initialize a project with a specific template
sdc init --name my-project --template node

# Auto-detect project type and suggest template
sdc init --auto

# Initialize with default template
sdc init
```

**Options:**
- `--global`, `-g`: Initialize global configuration
- `--name`, `-n`: Project name
- `--template`, `-t`: Base template to use
- `--auto`, `-a`: Auto-detect project type and recommend template

### `sdc update`

Update project's devcontainer.json from base template and project config.

```bash
sdc update
```

### `sdc template`

Manage local templates.

```bash
# List available templates
sdc template list

# Get template details
sdc template get node

# Create a new template
sdc template create my-custom-template

# Delete a template
sdc template delete my-custom-template
```

### `sdc repo-template`

Manage remote Git-based template repositories.

```bash
# Add a remote template repository
sdc repo-template add my-repo https://github.com/org/devcontainer-templates.git

# Add with authentication
sdc repo-template add my-repo https://github.com/org/private-templates.git --token <token>

# List configured repositories
sdc repo-template list

# Sync templates from remote repositories
sdc repo-template sync

# Remove a repository
sdc repo-template remove my-repo
```

**Options:**
- `--token`, `-t`: Personal access token for private repositories
- `--branch`, `-b`: Specify branch to use (default: main)
- `--auto-sync`: Enable automatic syncing

### `sdc sync`

Sync all projects in a directory to the latest base template.

```bash
# Sync all projects in current directory
sdc sync

# Sync projects in a specific directory
sdc sync ~/projects

# Check which projects need syncing (dry-run)
sdc sync check
```

### `sdc scaffold`

Create a new project with complete devcontainer setup.

```bash
# Scaffold a new project
sdc scaffold my-new-project --template node

# Scaffold with git initialization
sdc scaffold my-project --template bun --git

# Scaffold and install dependencies
sdc scaffold my-project --template python --install

# Open in VS Code after scaffolding
sdc scaffold my-project --template node --code
```

**Options:**
- `--template`, `-t`: Base template to use
- `--git`, `-g`: Initialize git repository
- `--install`, `-i`: Install project dependencies
- `--code`, `-c`: Open in VS Code after creation
- `--container`: Run installation inside container

### `sdc wizard`

Interactive setup wizard for guided configuration.

```bash
# Start the interactive wizard
sdc wizard

# Quick wizard mode
sdc wizard --quick
```

The wizard guides you through:
- Global vs project initialization
- Template selection
- Project configuration
- Feature and extension selection

## Built-in Templates

### `base`
Basic Ubuntu container with zsh, git, GitHub CLI, and Docker-in-Docker.

### `node`
Node.js 22 with npm, ESLint, Prettier, and common web development extensions.

### `bun`
Bun runtime with TypeScript support.

### `python`
Python 3.12 with Black formatter, Ruff linter, and Pylance.

### `claude-zsh`
Ubuntu container with:
- [zsh4humans](https://github.com/romkatv/zsh4humans) - Modern zsh configuration
- [Claude Code](https://claude.com/claude-code) - AI-powered coding assistant
- Docker-in-Docker for container workflows

## Configuration

### Global Config

Located at `~/.shared-dev-containers/config.json`:

```json
{
  "templatesDir": "/home/user/.shared-dev-containers/templates",
  "defaultImage": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "defaultFeatures": {
    "ghcr.io/devcontainers/features/common-utils:2": {
      "installZsh": true,
      "configureZshAsDefaultShell": true
    }
  }
}
```

### Project Config

Located at `.devcontainer/sdc.json`:

```json
{
  "name": "project-name",
  "extends": "base",
  "features": {},
  "extensions": [],
  "env": {},
  "ports": [],
  "postCreateCommands": [],
  "overrides": {}
}
```

### Configuration Options

| Option | Description |
|--------|-------------|
| `name` | Project identifier |
| `extends` | Base template to extend |
| `features` | Additional devcontainer features to include |
| `extensions` | VS Code extensions to install |
| `env` | Environment variables |
| `ports` | Ports to forward |
| `postCreateCommands` | Commands to run after container creation |
| `overrides` | Direct overrides for devcontainer.json fields |

## How It Works

1. **Base Templates**: Define reusable devcontainer configurations stored globally at `~/.shared-dev-containers/templates/`

2. **Project Configuration**: Each project has an `sdc.json` that specifies:
   - Which base template to extend
   - Additional features to add
   - VS Code extensions
   - Environment variables
   - Port forwards
   - Post-create commands
   - Direct overrides

3. **Merging**: When you run `sdc update`, the tool:
   - Loads the base template
   - Applies project-specific additions
   - Generates the final `devcontainer.json`

4. **Syncing**: When base templates are updated, run `sdc sync` to propagate changes to all projects

## Advanced Features

### Project Type Auto-Detection

The analyzer can detect various project types and frameworks:

- **Node.js**: Express, Next.js, React, Vue, Angular, NestJS, and more
- **Python**: Django, Flask, FastAPI, and more
- **Bun**: Bun-specific projects
- **Go**: Go modules and frameworks
- **Rust**: Cargo-based projects
- **Java**: Maven/Gradle projects
- **Ruby**: Rails and other Ruby projects
- **PHP**: Composer-based projects
- **.NET**: C# and F# projects

Use `sdc init --auto` to automatically detect and suggest appropriate templates.

### Conflict Detection

When merging configurations, sdc can detect potential conflicts:

- Version mismatches between templates
- Conflicting environment variables
- Incompatible features
- Port conflicts
- Extension conflicts

Conflicts are reported with severity levels (error, warning, info) and suggested resolutions.

### Remote Template Repositories

Teams can share templates via Git repositories:

```bash
# Add team template repository
sdc repo-template add company-templates https://github.com/company/devcontainer-templates.git

# Sync to get latest templates
sdc repo-template sync

# Use templates from the repository
sdc init --template company-templates/backend-service
```

## Development

```bash
# Clone the repository
git clone https://github.com/your-org/shared-dev-containers.git
cd shared-dev-containers

# Install dependencies
bun install

# Run in development
bun run dev

# Run with arguments
bun run dev -- init --global

# Build for Bun
bun run build

# Build for Node.js
npm run build:node

# Run tests
bun test

# Run tests with Node.js
npm run test:node

# Lint code
npm run lint

# Format code
npm run format
```

### Project Structure

```
src/
├── cli.ts              # Main CLI entry point
├── index.ts            # Library exports
├── commands/           # Command implementations
│   ├── init.ts         # Initialize configurations
│   ├── scaffold.ts     # Create new projects
│   ├── sync.ts         # Sync projects to templates
│   ├── template.ts     # Manage local templates
│   ├── repo-template.ts # Manage remote repositories
│   └── wizard.ts       # Interactive setup
├── utils/              # Utility functions
│   ├── analyzer.ts     # Project type detection
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
└── types/              # TypeScript type definitions
    └── index.ts
```

## License

MIT
