#!/usr/bin/env bun
/**
 * shared-dev-containers CLI
 *
 * A tool for developers to have preconfigured devcontainers per project
 * with the ability to customize while maintaining compatibility with a shared base.
 */

import { initGlobal, initProject, updateProject } from "./commands/init.js";
import { listTemplates, getTemplate, createTemplate, deleteTemplate } from "./commands/template.js";
import { syncProjects, checkSync } from "./commands/sync.js";
import { scaffoldProject, listScaffoldTemplates } from "./commands/scaffold.js";
import { createBaseConfig } from "./utils/merge.js";
import { loadGlobalConfig } from "./utils/config.js";

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
  init [--global]          Initialize shared-dev-containers
    --global               Initialize global configuration
    --name <name>          Project name (for project init)
    --template <template>  Base template to use (default: base)

  scaffold <directory>     Create a new project with full setup
    --name <name>          Project name
    --template <template>  Template to use (base, node, bun, python, claude-zsh)
    --skip-git             Skip git initialization
    --skip-install         Skip dependency installation
    --skip-vscode          Skip opening in VSCode
    --install-in-container Install dependencies inside container instead

  update                   Update project devcontainer from base template

  template <subcommand>    Manage templates
    list                   List available templates
    get <name>             Show template details
    create <name>          Create a new template from current config
    delete <name>          Delete a template

  sync [directory]         Sync all projects in directory to latest template
    check                  Check which projects need syncing

  help                     Show this help message
  version                  Show version

EXAMPLES:
  # Initialize global configuration
  sdc init --global

  # Initialize a new project
  sdc init --name my-project

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
          });
          console.log(result.message);
          process.exit(result.success ? 0 : 1);
        }
        break;
      }

      case "update": {
        const projectDir = parsed.positional[0] || process.cwd();
        const result = await updateProject(projectDir);
        console.log(result.message);
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
