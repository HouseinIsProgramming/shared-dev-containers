#!/usr/bin/env bun
/**
 * shared-dev-containers CLI
 *
 * A tool for developers to have preconfigured devcontainers per project
 * with the ability to customize while maintaining compatibility with a shared base.
 */

import { initGlobal, initProject, updateProject, analyzeProjectCommand } from "./commands/init.js";
import { listTemplates, getTemplate, createTemplate, deleteTemplate } from "./commands/template.js";
import { syncProjects, checkSync } from "./commands/sync.js";
import { scaffoldProject, listScaffoldTemplates } from "./commands/scaffold.js";
import { runWizard, runQuickWizard } from "./commands/wizard.js";
import {
  addRemoteRepository,
  removeRemoteRepository,
  listRemoteRepositories,
  syncRemoteRepositories,
  getRemoteRepoTemplate,
  listAllRemoteTemplates,
  updateRemoteRepository,
  configureRemoteSettings,
} from "./commands/repo-template.js";
import { createBaseConfig } from "./utils/merge.js";
import { loadGlobalConfig } from "./utils/config.js";
import { formatDiffForConsole, formatDiffSummary } from "./utils/diff.js";
import type { GitAuthType, DryRunResult, FileDiff } from "./types/index.js";

const VERSION = "0.1.0";

interface ParsedArgs {
  command: string;
  subcommand?: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: "",
    flags: {},
    positional: [],
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("-")) {
        result.flags[key] = nextArg;
        i += 2;
      } else {
        result.flags[key] = true;
        i++;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      result.flags[key] = true;
      i++;
    } else {
      if (!result.command) {
        result.command = arg;
      } else if (!result.subcommand && isSubcommand(result.command, arg)) {
        result.subcommand = arg;
      } else {
        result.positional.push(arg);
      }
      i++;
    }
  }

  return result;
}

/**
 * Check if an argument is a valid subcommand for the given command
 */
function isSubcommand(command: string, arg: string): boolean {
  const subcommands: Record<string, string[]> = {
    template: ["list", "get", "create", "delete"],
    sync: ["check"],
    repo: ["add", "remove", "list", "sync", "get", "update", "config"],
  };

  return subcommands[command]?.includes(arg) ?? false;
}

/**
 * Print usage information
 */
function printHelp(): void {
  console.log(`
shared-dev-containers (sdc) v${VERSION}

A tool for managing shared devcontainer configurations across projects.

USAGE:
  sdc <command> [options]

COMMANDS:
  wizard [directory]       Interactive wizard for configuring devcontainers
    --quick                Quick setup with minimal prompts
    --template <template>  Pre-select template for quick mode

  init [--global]          Initialize shared-dev-containers
    --global               Initialize global configuration
    --name <name>          Project name (for project init)
    --template <template>  Base template to use (default: base)
    --auto                 Auto-detect project type and suggest template

  analyze [directory]      Analyze project and suggest template/customizations

  scaffold <directory>     Create a new project with full setup
    --name <name>          Project name
    --template <template>  Template to use (base, node, bun, python, claude-zsh)
    --skip-git             Skip git initialization
    --skip-install         Skip dependency installation
    --skip-vscode          Skip opening in VSCode
    --install-in-container Install dependencies inside container instead

  update                   Update project devcontainer from base template
    --dry-run              Preview changes without applying them

  template <subcommand>    Manage templates
    list                   List available templates
    get <name>             Show template details
    create <name>          Create a new template from current config
    delete <name>          Delete a template

  repo <subcommand>        Manage remote Git template repositories
    add <name> <url>       Add a remote repository
      --branch <branch>    Branch to use (default: main)
      --auth <type>        Auth type: ssh, https, token, none
      --credentials <path> Path to SSH key or token file
      --sync-interval <h>  Auto-sync interval in hours (0 = manual)
      --templates-path <p> Subdirectory containing templates
    remove <name>          Remove a remote repository
    list                   List configured repositories
    sync [name]            Sync remote repository(ies)
    get <repo> <template>  Get template from a remote repository
    update <name>          Update repository configuration
      --branch <branch>    New branch to track
      --auth <type>        New auth type
      --credentials <path> New credentials path
      --sync-interval <h>  New sync interval
    config                 Configure remote template settings
      --auto-sync <bool>   Enable/disable auto-sync
      --default-interval <h> Default sync interval in hours

  sync [directory]         Sync all projects in directory to latest template
    check                  Check which projects need syncing
    --dry-run              Preview changes without applying them

  help                     Show this help message
  version                  Show version

EXAMPLES:
  # Run the interactive configuration wizard
  sdc wizard

  # Quick setup with minimal prompts
  sdc wizard --quick

  # Quick setup with pre-selected template
  sdc wizard --quick --template node

  # Initialize global configuration
  sdc init --global

  # Initialize a new project
  sdc init --name my-project

  # Initialize with auto-detection (analyzes package.json, requirements.txt, etc.)
  sdc init --auto

  # Analyze a project to see template recommendations
  sdc analyze

  # Scaffold a new Node.js project with full setup
  sdc scaffold ./my-app --template node --name my-app

  # Scaffold a Python project without opening VSCode
  sdc scaffold ./my-python-app --template python --skip-vscode

  # Update project devcontainer
  sdc update

  # List available templates
  sdc template list

  # Sync all projects
  sdc sync ~/projects

  # Add a remote Git template repository
  sdc repo add company-templates https://github.com/company/devcontainer-templates.git

  # Add a private repository with SSH authentication
  sdc repo add private-templates git@github.com:company/private-templates.git --auth ssh

  # Add a private repository with token authentication
  sdc repo add secure-templates https://github.com/company/templates.git --auth token --credentials /path/to/token

  # List all remote repositories
  sdc repo list

  # Sync all remote repositories
  sdc repo sync

  # Get a template from a remote repository
  sdc repo get company-templates node
`);
}

/**
 * Print version
 */
function printVersion(): void {
  console.log(`shared-dev-containers v${VERSION}`);
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  // Skip first two args (bun/node and script path)
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  if (parsed.flags.help || parsed.flags.h || parsed.command === "help") {
    printHelp();
    process.exit(0);
  }

  if (parsed.flags.version || parsed.flags.v || parsed.command === "version") {
    printVersion();
    process.exit(0);
  }

  if (!parsed.command) {
    printHelp();
    process.exit(1);
  }

  try {
    switch (parsed.command) {
      case "init": {
        if (parsed.flags.global) {
          const result = await initGlobal();
          console.log(result.message);
          process.exit(result.success ? 0 : 1);
        } else {
          const projectDir = parsed.positional[0] || process.cwd();
          const result = await initProject(projectDir, {
            name: parsed.flags.name as string,
            template: parsed.flags.template as string,
            auto: parsed.flags.auto === true,
          });
          console.log(result.message);

          // If auto-detection was used, show additional info
          const initData = result.data as { analysis?: { frameworks?: Array<{ name: string }> } } | undefined;
          if (initData?.analysis?.frameworks?.length) {
            console.log("\nDetected frameworks:");
            initData.analysis.frameworks.forEach((fw: { name: string }) => {
              console.log(`  - ${fw.name}`);
            });
          }

          process.exit(result.success ? 0 : 1);
        }
        break;
      }

      case "analyze": {
        const projectDir = parsed.positional[0] || process.cwd();
        const result = await analyzeProjectCommand(projectDir);
        console.log(result.message);
        process.exit(result.success ? 0 : 1);
        break;
      }

      case "update": {
        const projectDir = parsed.positional[0] || process.cwd();
        const dryRun = parsed.flags["dry-run"] === true;
        const result = await updateProject(projectDir, { dryRun });
        console.log(result.message);

        // If dry-run mode, display the diff
        if (dryRun && result.data) {
          const data = result.data as { dryRun?: boolean; result?: DryRunResult };
          if (data.result) {
            const { diffs, wouldChange } = data.result;
            if (wouldChange && diffs.length > 0) {
              console.log("\n--- Changes that would be applied ---");
              diffs.forEach((diff) => {
                console.log(formatDiffForConsole(diff));
              });
              console.log("\n--- Summary ---");
              console.log(formatDiffSummary(diffs));
            }
          }
        }

        process.exit(result.success ? 0 : 1);
        break;
      }

      case "scaffold": {
        const projectDir = parsed.positional[0];
        if (!projectDir) {
          console.error("Error: Project directory required");
          console.log("Usage: sdc scaffold <directory> [--template <template>] [--name <name>]");
          console.log("\nAvailable templates:", listScaffoldTemplates().join(", "));
          process.exit(1);
        }

        // Resolve to absolute path
        const { resolve } = await import("node:path");
        const absoluteProjectDir = resolve(process.cwd(), projectDir);

        const scaffoldResult = await scaffoldProject(absoluteProjectDir, {
          name: parsed.flags.name as string,
          template: parsed.flags.template as string,
          skipGit: parsed.flags["skip-git"] === true,
          skipInstall: parsed.flags["skip-install"] === true,
          skipVscode: parsed.flags["skip-vscode"] === true,
          installInContainer: parsed.flags["install-in-container"] === true,
        });

        console.log(scaffoldResult.message);

        // Print detailed steps
        const scaffoldData = scaffoldResult.data as { steps?: string[] } | undefined;
        if (scaffoldData?.steps) {
          console.log("\nSetup steps:");
          scaffoldData.steps.forEach((step) => console.log(`  • ${step}`));
        }

        if (scaffoldResult.success) {
          console.log("\n✓ Project ready! Open VSCode and use 'Reopen in Container' to start developing.");
        }

        process.exit(scaffoldResult.success ? 0 : 1);
        break;
      }

      case "template": {
        switch (parsed.subcommand) {
          case "list": {
            const result = await listTemplates();
            console.log(result.message);
            const data = result.data as { templates?: string[] } | undefined;
            if (data?.templates) {
              data.templates.forEach((t) => console.log(`  - ${t}`));
            }
            process.exit(result.success ? 0 : 1);
            break;
          }

          case "get": {
            const name = parsed.positional[0];
            if (!name) {
              console.error("Error: Template name required");
              process.exit(1);
            }
            const result = await getTemplate(name);
            const data = result.data as { config?: unknown } | undefined;
            if (result.success && data?.config) {
              console.log(JSON.stringify(data.config, null, 2));
            } else {
              console.error(result.message);
            }
            process.exit(result.success ? 0 : 1);
            break;
          }

          case "create": {
            const name = parsed.positional[0];
            if (!name) {
              console.error("Error: Template name required");
              process.exit(1);
            }
            const globalConfig = await loadGlobalConfig();
            const baseConfig = createBaseConfig(globalConfig);
            const result = await createTemplate(name, baseConfig);
            console.log(result.message);
            process.exit(result.success ? 0 : 1);
            break;
          }

          case "delete": {
            const name = parsed.positional[0];
            if (!name) {
              console.error("Error: Template name required");
              process.exit(1);
            }
            const result = await deleteTemplate(name);
            console.log(result.message);
            process.exit(result.success ? 0 : 1);
            break;
          }

          default:
            console.error(`Unknown template subcommand: ${parsed.subcommand}`);
            console.log("Available: list, get, create, delete");
            process.exit(1);
        }
        break;
      }

      case "sync": {
        const directory = parsed.positional[0] || process.cwd();

        if (parsed.subcommand === "check") {
          const result = await checkSync(directory);
          console.log(result.message);
          const checkData = result.data as { needsSync?: Array<{ name: string; path: string }> } | undefined;
          if (checkData?.needsSync) {
            checkData.needsSync.forEach((p) => console.log(`  - ${p.name}: ${p.path}`));
          }
          process.exit(result.success ? 0 : 1);
        } else {
          const result = await syncProjects(directory);
          console.log(result.message);
          const syncData = result.data as { results?: Array<{ project: string; success: boolean; message: string }> } | undefined;
          if (syncData?.results) {
            syncData.results.forEach((r) => {
              const status = r.success ? "✓" : "✗";
              console.log(`  ${status} ${r.project}: ${r.message}`);
            });
          }
          process.exit(result.success ? 0 : 1);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${parsed.command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run CLI
main();
