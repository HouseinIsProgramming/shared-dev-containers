# shared-dev-containers (sdc)

A tool for developers to have preconfigured devcontainers per project with the ability to customize while maintaining compatibility with a shared base configuration.

## Features

- **Shared Base Templates**: Define common devcontainer configurations that can be used across multiple projects
- **Project Customization**: Each project can extend and customize the base configuration
- **Automatic Merging**: Changes to base templates can be synced to all projects
- **Built-in Templates**: Comes with templates for Node.js, Bun, Python, and a Claude + zsh4humans setup
- **CLI Tool**: Easy-to-use command line interface for managing devcontainers

## Installation

### Using Bun (recommended)

```bash
bun install -g shared-dev-containers
```

### Using npm

```bash
npm install -g shared-dev-containers
```

## Quick Start

1. **Initialize global configuration**

```bash
sdc init --global
```

This creates the global configuration directory at `~/.shared-dev-containers/` with default templates.

2. **Initialize a project**

```bash
cd your-project
sdc init --name my-project --template node
```

This creates a `.devcontainer/` directory with:
- `devcontainer.json` - The merged devcontainer configuration
- `sdc.json` - Project-specific customizations

3. **Customize your project**

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

4. **Update devcontainer.json**

```bash
sdc update
```

This regenerates `devcontainer.json` by merging the base template with your project customizations.

## Commands

### `sdc init`

Initialize shared-dev-containers.

```bash
# Initialize global configuration
sdc init --global

# Initialize a project
sdc init --name my-project --template node

# Initialize with default template
sdc init
```

### `sdc update`

Update project's devcontainer.json from base template and project config.

```bash
sdc update
```

### `sdc template`

Manage templates.

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

### `sdc sync`

Sync all projects in a directory to the latest base template.

```bash
# Sync all projects in current directory
sdc sync

# Sync projects in a specific directory
sdc sync ~/projects

# Check which projects need syncing
sdc sync check
```

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

## Configuration Files

### Global Config (`~/.shared-dev-containers/config.json`)

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

### Project Config (`.devcontainer/sdc.json`)

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

## How It Works

1. **Base Templates**: Define reusable devcontainer configurations stored globally
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

## Development

```bash
# Clone the repository
git clone https://github.com/your-org/shared-dev-containers.git
cd shared-dev-containers

# Install dependencies
bun install

# Run in development
bun run dev

# Build
bun run build

# Run tests
bun test
```

## License

MIT
