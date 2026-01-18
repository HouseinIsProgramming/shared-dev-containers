/**
 * Scaffold command - combines project scaffolding with devcontainer setup
 *
 * This command provides a unified workflow to:
 * 1. Initialize a git repository
 * 2. Install dependencies based on template
 * 3. Setup devcontainer configuration
 * 4. Open the project in VSCode with devcontainer
 */

import { mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { spawn } from "node:child_process";
import { initProject } from "./init.js";
import { exists } from "../utils/config.js";
import { listBuiltinTemplates } from "../templates/index.js";
import type { CommandResult } from "../types/index.js";

/**
 * Options for scaffolding a new project
 */
export interface ScaffoldOptions {
  /** Project name */
  name?: string;
  /** Template to use (base, node, bun, python, claude-zsh) */
  template?: string;
  /** Skip git initialization */
  skipGit?: boolean;
  /** Skip dependency installation */
  skipInstall?: boolean;
  /** Skip opening in VSCode */
  skipVscode?: boolean;
  /** Install dependencies inside container instead of locally */
  installInContainer?: boolean;
}

/**
 * Result data from scaffold operation
 */
export interface ScaffoldResultData {
  projectDir: string;
  projectName: string;
  template: string;
  gitInitialized: boolean;
  dependenciesInstalled: boolean;
  vscodeOpened: boolean;
  steps: string[];
}

/**
 * Execute a command and return a promise
 */
function execCommand(command: string, args: string[], cwd: string): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    let errorOutput = "";

    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      errorOutput += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        success: code === 0,
        output: code === 0 ? output : errorOutput || output,
      });
    });

    proc.on("error", (err) => {
      resolve({
        success: false,
        output: err.message,
      });
    });
  });
}

/**
 * Check if a command is available
 */
async function commandExists(command: string): Promise<boolean> {
  const result = await execCommand("which", [command], process.cwd());
  return result.success;
}

/**
 * Initialize git repository
 */
async function initGitRepo(projectDir: string): Promise<{ success: boolean; message: string }> {
  const gitDir = join(projectDir, ".git");

  if (await exists(gitDir)) {
    return { success: true, message: "Git repository already exists" };
  }

  const result = await execCommand("git", ["init"], projectDir);
  if (!result.success) {
    return { success: false, message: `Failed to initialize git: ${result.output}` };
  }

  // Create initial .gitignore if it doesn't exist
  const gitignorePath = join(projectDir, ".gitignore");
  if (!(await exists(gitignorePath))) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(gitignorePath, `# Dependencies
node_modules/
.venv/
__pycache__/

# Build outputs
dist/
build/
*.egg-info/

# IDE
.idea/
*.swp
*.swo

# Environment
.env
.env.local

# OS
.DS_Store
Thumbs.db
`);
  }

  return { success: true, message: "Git repository initialized" };
}

/**
 * Get the package manager and install command based on template
 */
function getInstallCommand(template: string): { command: string; args: string[]; fileToCheck: string } | null {
  switch (template) {
    case "node":
      return { command: "npm", args: ["install"], fileToCheck: "package.json" };
    case "bun":
      return { command: "bun", args: ["install"], fileToCheck: "package.json" };
    case "python":
      return { command: "pip", args: ["install", "-r", "requirements.txt"], fileToCheck: "requirements.txt" };
    default:
      return null;
  }
}

/**
 * Install dependencies based on template type
 */
async function installDependencies(
  projectDir: string,
  template: string
): Promise<{ success: boolean; message: string; skipped: boolean }> {
  const installConfig = getInstallCommand(template);

  if (!installConfig) {
    return { success: true, message: "No dependencies to install for this template", skipped: true };
  }

  // Check if the dependency file exists
  const depFilePath = join(projectDir, installConfig.fileToCheck);
  if (!(await exists(depFilePath))) {
    return {
      success: true,
      message: `No ${installConfig.fileToCheck} found, skipping dependency installation`,
      skipped: true
    };
  }

  // Check if the package manager is available
  if (!(await commandExists(installConfig.command))) {
    return {
      success: true,
      message: `${installConfig.command} not found, dependencies will be installed in container`,
      skipped: true
    };
  }

  const result = await execCommand(installConfig.command, installConfig.args, projectDir);
  if (!result.success) {
    return {
      success: false,
      message: `Failed to install dependencies: ${result.output}`,
      skipped: false
    };
  }

  return { success: true, message: "Dependencies installed successfully", skipped: false };
}

/**
 * Open project in VSCode with devcontainer
 */
async function openInVscode(projectDir: string): Promise<{ success: boolean; message: string }> {
  // Check if 'code' command is available
  if (!(await commandExists("code"))) {
    return {
      success: false,
      message: "VSCode 'code' command not found. Install VSCode and add to PATH, or run: code --install-extension ms-vscode-remote.remote-containers"
    };
  }

  // Open the folder in VSCode - it will detect the devcontainer automatically
  const result = await execCommand("code", [projectDir], projectDir);

  if (!result.success) {
    return { success: false, message: `Failed to open VSCode: ${result.output}` };
  }

  return {
    success: true,
    message: "Opened in VSCode. Use 'Reopen in Container' from the command palette (F1) to start the devcontainer."
  };
}

/**
 * List available templates for scaffolding
 */
export function listScaffoldTemplates(): string[] {
  return listBuiltinTemplates();
}

/**
 * Scaffold a new project with devcontainer setup
 *
 * This is the main entry point that combines:
 * - Creating project directory (if needed)
 * - Initializing git repository
 * - Setting up devcontainer configuration
 * - Installing dependencies
 * - Opening in VSCode
 */
export async function scaffoldProject(
  projectDir: string,
  options: ScaffoldOptions = {}
): Promise<CommandResult<ScaffoldResultData>> {
  const steps: string[] = [];
  const projectName = options.name || basename(projectDir);
  const template = options.template || "base";

  // Validate template
  const availableTemplates = listBuiltinTemplates();
  if (!availableTemplates.includes(template)) {
    return {
      success: false,
      message: `Invalid template "${template}". Available templates: ${availableTemplates.join(", ")}`,
    };
  }

  try {
    // Step 1: Create project directory if it doesn't exist
    if (!(await exists(projectDir))) {
      await mkdir(projectDir, { recursive: true });
      steps.push(`Created project directory: ${projectDir}`);
    }

    // Step 2: Initialize git repository
    let gitInitialized = false;
    if (!options.skipGit) {
      const gitResult = await initGitRepo(projectDir);
      if (gitResult.success) {
        gitInitialized = true;
        steps.push(`Git: ${gitResult.message}`);
      } else {
        steps.push(`Git (warning): ${gitResult.message}`);
      }
    } else {
      steps.push("Git: Skipped (--skip-git)");
    }

    // Step 3: Initialize devcontainer with template
    const initResult = await initProject(projectDir, {
      name: projectName,
      template: template,
    });

    if (!initResult.success) {
      // If already initialized, that's okay for scaffolding
      if (initResult.message.includes("already initialized")) {
        steps.push("Devcontainer: Already configured");
      } else {
        return {
          success: false,
          message: `Failed to setup devcontainer: ${initResult.message}`,
          data: {
            projectDir,
            projectName,
            template,
            gitInitialized,
            dependenciesInstalled: false,
            vscodeOpened: false,
            steps,
          },
        };
      }
    } else {
      steps.push(`Devcontainer: Initialized with "${template}" template`);
    }

    // Step 4: Install dependencies (if applicable and not skipped)
    let dependenciesInstalled = false;
    if (!options.skipInstall && !options.installInContainer) {
      const installResult = await installDependencies(projectDir, template);
      if (installResult.success) {
        dependenciesInstalled = !installResult.skipped;
        steps.push(`Dependencies: ${installResult.message}`);
      } else {
        steps.push(`Dependencies (warning): ${installResult.message}`);
      }
    } else if (options.installInContainer) {
      steps.push("Dependencies: Will be installed inside container");
    } else {
      steps.push("Dependencies: Skipped (--skip-install)");
    }

    // Step 5: Open in VSCode (if not skipped)
    let vscodeOpened = false;
    if (!options.skipVscode) {
      const vscodeResult = await openInVscode(projectDir);
      if (vscodeResult.success) {
        vscodeOpened = true;
        steps.push(`VSCode: ${vscodeResult.message}`);
      } else {
        steps.push(`VSCode (warning): ${vscodeResult.message}`);
      }
    } else {
      steps.push("VSCode: Skipped (--skip-vscode)");
    }

    return {
      success: true,
      message: `Successfully scaffolded project "${projectName}" with ${template} template`,
      data: {
        projectDir,
        projectName,
        template,
        gitInitialized,
        dependenciesInstalled,
        vscodeOpened,
        steps,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to scaffold project: ${error instanceof Error ? error.message : String(error)}`,
      data: {
        projectDir,
        projectName,
        template,
        gitInitialized: false,
        dependenciesInstalled: false,
        vscodeOpened: false,
        steps,
      },
    };
  }
}
