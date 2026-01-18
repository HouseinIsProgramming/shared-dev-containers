# shared-dev-containers (sdc)

A CLI tool for managing shared devcontainer configurations across projects. Define base templates and customize them per-project while keeping everything in sync.

## Installation

```bash
# Using npm
npm install -g shared-dev-containers

# Using Bun (recommended)
bun install -g shared-dev-containers
```

**Requirements:** Node.js >= 22.0.0 or Bun >= 1.0.0

## Quick Start

```bash
# Run the interactive wizard (easiest way to get started)
sdc wizard

# Or initialize manually
sdc init --global              # Set up global config
sdc init --auto                # Initialize project with auto-detection
```

## Core Commands

| Command | Description |
|---------|-------------|
| `sdc wizard` | Interactive setup wizard |
| `sdc init` | Initialize global config or project |
| `sdc update` | Regenerate devcontainer.json from template + customizations |
| `sdc sync` | Update all projects to latest template |
| `sdc scaffold <dir>` | Create a new project with full setup |
| `sdc analyze` | Analyze project type and get recommendations |

## Built-in Templates

| Template | Description |
|----------|-------------|
| `base` | Ubuntu with zsh, git, GitHub CLI, Docker-in-Docker |
| `node` | Node.js 22 with ESLint, Prettier |
| `bun` | Bun runtime with TypeScript |
| `python` | Python 3.12 with Black, Ruff, Pylance |
| `claude-zsh` | zsh4humans + Claude Code + Docker-in-Docker |

## Features

### Project Customization

Each project gets an `sdc.json` file for customizations:

```json
{
  "name": "my-project",
  "extends": "node",
  "features": { "ghcr.io/devcontainers/features/aws-cli:1": {} },
  "extensions": ["amazonwebservices.aws-toolkit-vscode"],
  "env": { "NODE_ENV": "development" },
  "ports": [4000],
  "postCreateCommands": ["npm run setup"]
}
```

### User Customizations

Apply personal dotfiles and shell config to all your devcontainers:

```bash
sdc customize dotfiles https://github.com/user/dotfiles.git
sdc customize shell ~/.zshrc
sdc customize env EDITOR vim
sdc customize show                # View current customizations
```

### Remote Template Repositories

Share templates across your team via Git:

```bash
sdc repo add company https://github.com/company/templates.git
sdc repo sync
sdc init --template company/backend-service
```

### Dry-Run Mode

Preview changes before applying:

```bash
sdc update --dry-run
sdc sync --dry-run
```

## Command Reference

### `sdc wizard`

Interactive configuration wizard.

```bash
sdc wizard                    # Full interactive wizard
sdc wizard --quick            # Quick setup with defaults
sdc wizard --quick --template node
```

### `sdc init`

Initialize global configuration or a project.

```bash
sdc init --global             # Initialize global config
sdc init                      # Initialize current directory
sdc init --auto               # Auto-detect project type
sdc init --template node      # Use specific template
sdc init --name my-project    # Set project name
```

### `sdc update`

Regenerate `devcontainer.json` by merging template with project customizations.

```bash
sdc update                    # Update current project
sdc update --dry-run          # Preview changes only
```

### `sdc sync`

Sync all projects in a directory to latest template.

```bash
sdc sync                      # Sync projects in current directory
sdc sync ~/projects           # Sync projects in specific directory
sdc sync check                # Check which projects need syncing
sdc sync --dry-run            # Preview changes only
```

### `sdc scaffold`

Create a new project with complete devcontainer setup.

```bash
sdc scaffold ./my-app --template node
sdc scaffold ./api --template python --skip-vscode
sdc scaffold ./service --template bun --skip-git
```

### `sdc template`

Manage local templates.

```bash
sdc template list             # List available templates
sdc template get node         # Show template details
sdc template create my-tmpl   # Create custom template
sdc template delete my-tmpl   # Delete template
```

### `sdc repo`

Manage remote Git template repositories.

```bash
sdc repo add name url         # Add remote repository
sdc repo add name url --auth ssh --branch develop
sdc repo remove name          # Remove repository
sdc repo list                 # List repositories
sdc repo sync                 # Sync all repositories
sdc repo get repo-name tmpl   # Get specific template
```

### `sdc customize`

Manage personal customizations applied to all devcontainers.

```bash
# Dotfiles
sdc customize dotfiles https://github.com/user/dotfiles.git
sdc customize dotfiles https://... --install "./install.sh"
sdc customize dotfiles --remove

# Shell config
sdc customize shell ~/.zshrc
sdc customize shell ~/.zshrc --target ~/.zshrc
sdc customize shell --remove

# Environment variables
sdc customize env MY_VAR value
sdc customize env MY_VAR --remove

# View/clear
sdc customize show
sdc customize clear
```

### `sdc analyze`

Analyze project and suggest template/customizations.

```bash
sdc analyze                   # Analyze current directory
sdc analyze ./my-project      # Analyze specific directory
```

## Configuration Files

### Global Config (`~/.shared-dev-containers/config.json`)

```json
{
  "templatesDir": "~/.shared-dev-containers/templates",
  "defaultImage": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "userCustomizations": {
    "dotfilesRepo": "https://github.com/user/dotfiles.git",
    "shellConfigSource": "~/.zshrc",
    "customEnvVars": { "EDITOR": "vim" }
  }
}
```

### Project Config (`.devcontainer/sdc.json`)

```json
{
  "name": "project-name",
  "extends": "node",
  "features": {},
  "extensions": [],
  "env": {},
  "ports": [],
  "postCreateCommands": [],
  "overrides": {}
}
```

## How It Works

1. **Base Templates** - Reusable devcontainer configurations stored globally
2. **User Customizations** - Personal dotfiles/shell config applied to all containers
3. **Project Config** - Per-project extensions, ports, env vars, etc.
4. **Merging** - `sdc update` combines template + user customizations + project config
5. **Syncing** - `sdc sync` propagates template changes to all projects

## Development

```bash
git clone https://github.com/your-org/shared-dev-containers.git
cd shared-dev-containers
bun install
bun run dev                   # Run in development
bun run build                 # Build for Bun
npm run build:node            # Build for Node.js
bun test                      # Run tests
```

## License

MIT
