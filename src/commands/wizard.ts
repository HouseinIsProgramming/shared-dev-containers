/**
 * Interactive CLI wizard for devcontainer configuration
 *
 * Walks users through customizing templates with prompts for common options
 * (extensions, runtime versions, ports, etc.) instead of manual JSON editing.
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  promptText,
  promptConfirm,
  promptSelect,
  promptMultiSelect,
  promptPorts,
  promptList,
  printSection,
  printSuccess,
  printInfo,
  printWelcome,
  type SelectOption,
} from "../utils/prompts.js";
import { listBuiltinTemplates, getBuiltinTemplate } from "../templates/index.js";
import {
  loadGlobalConfig,
  saveProjectConfig,
  saveDevcontainerConfig,
  exists,
} from "../utils/config.js";
import { createBaseConfig, mergeConfigs } from "../utils/merge.js";
import type { ProjectConfig, CommandResult, DevcontainerConfig } from "../types/index.js";

/**
 * Template metadata for wizard prompts
 */
interface TemplateMetadata {
  name: string;
  displayName: string;
  description: string;
  defaultPorts: number[];
  runtimeVersionPrompt?: {
    question: string;
    options: SelectOption<string>[];
    featureKey: string;
    featureVersion: string;
  };
  suggestedExtensions: SelectOption<string>[];
  postCreateCommands?: string[];
}

/**
 * Get metadata for built-in templates
 */
function getTemplateMetadata(): Record<string, TemplateMetadata> {
  return {
    base: {
      name: "base",
      displayName: "Base (Ubuntu)",
      description: "Basic Ubuntu container with zsh, git, and Docker-in-Docker",
      defaultPorts: [],
      suggestedExtensions: [
        { label: "GitLens", value: "eamodio.gitlens", description: "Enhanced Git visualization" },
        { label: "Docker", value: "ms-azuretools.vscode-docker", description: "Docker integration" },
        { label: "Prettier", value: "esbenp.prettier-vscode", description: "Code formatter" },
        { label: "Code Spell Checker", value: "streetsidesoftware.code-spell-checker", description: "Spelling checker" },
        { label: "GitHub Copilot", value: "github.copilot", description: "AI pair programmer" },
        { label: "Error Lens", value: "usernamehw.errorlens", description: "Inline error highlighting" },
      ],
    },
    node: {
      name: "node",
      displayName: "Node.js",
      description: "Node.js development environment with npm",
      defaultPorts: [3000, 5173, 8080],
      runtimeVersionPrompt: {
        question: "Which Node.js version?",
        options: [
          { label: "Node.js 22 (LTS)", value: "22", description: "Latest LTS version (Recommended)" },
          { label: "Node.js 20 (LTS)", value: "20", description: "Previous LTS version" },
          { label: "Node.js 18", value: "18", description: "Older LTS version" },
        ],
        featureKey: "ghcr.io/devcontainers/features/node:1",
        featureVersion: "version",
      },
      suggestedExtensions: [
        { label: "ESLint", value: "dbaeumer.vscode-eslint", description: "JavaScript linter" },
        { label: "Prettier", value: "esbenp.prettier-vscode", description: "Code formatter" },
        { label: "npm Intellisense", value: "christian-kohler.npm-intellisense", description: "npm autocomplete" },
        { label: "Tailwind CSS", value: "bradlc.vscode-tailwindcss", description: "Tailwind CSS support" },
        { label: "Auto Import", value: "steoates.autoimport", description: "Auto import suggestions" },
        { label: "Path Intellisense", value: "christian-kohler.path-intellisense", description: "Path autocomplete" },
        { label: "Jest", value: "orta.vscode-jest", description: "Jest test runner" },
        { label: "REST Client", value: "humao.rest-client", description: "HTTP request testing" },
      ],
      postCreateCommands: ["npm install"],
    },
    bun: {
      name: "bun",
      displayName: "Bun",
      description: "Bun runtime for fast JavaScript/TypeScript",
      defaultPorts: [3000, 5173, 8080],
      suggestedExtensions: [
        { label: "Bun", value: "oven.bun-vscode", description: "Bun runtime support" },
        { label: "Prettier", value: "esbenp.prettier-vscode", description: "Code formatter" },
        { label: "Tailwind CSS", value: "bradlc.vscode-tailwindcss", description: "Tailwind CSS support" },
        { label: "Path Intellisense", value: "christian-kohler.path-intellisense", description: "Path autocomplete" },
        { label: "REST Client", value: "humao.rest-client", description: "HTTP request testing" },
      ],
      postCreateCommands: ["bun install"],
    },
    python: {
      name: "python",
      displayName: "Python",
      description: "Python development environment with pip",
      defaultPorts: [8000, 5000],
      runtimeVersionPrompt: {
        question: "Which Python version?",
        options: [
          { label: "Python 3.12", value: "3.12", description: "Latest stable (Recommended)" },
          { label: "Python 3.11", value: "3.11", description: "Previous stable version" },
          { label: "Python 3.10", value: "3.10", description: "Older stable version" },
        ],
        featureKey: "ghcr.io/devcontainers/features/python:1",
        featureVersion: "version",
      },
      suggestedExtensions: [
        { label: "Python", value: "ms-python.python", description: "Python language support" },
        { label: "Pylance", value: "ms-python.vscode-pylance", description: "Fast Python language server" },
        { label: "Black Formatter", value: "ms-python.black-formatter", description: "Python code formatter" },
        { label: "Ruff", value: "charliermarsh.ruff", description: "Fast Python linter" },
        { label: "Python Docstring", value: "njpwerner.autodocstring", description: "Generate docstrings" },
        { label: "Jupyter", value: "ms-toolsai.jupyter", description: "Jupyter notebook support" },
        { label: "Python Test Explorer", value: "littlefoxteam.vscode-python-test-adapter", description: "Test discovery" },
      ],
      postCreateCommands: ["pip install -r requirements.txt || true"],
    },
    "claude-zsh": {
      name: "claude-zsh",
      displayName: "Claude Code + zsh4humans",
      description: "Claude Code CLI with enhanced zsh configuration",
      defaultPorts: [3000, 5173, 8080],
      suggestedExtensions: [
        { label: "GitLens", value: "eamodio.gitlens", description: "Enhanced Git visualization" },
        { label: "Docker", value: "ms-azuretools.vscode-docker", description: "Docker integration" },
        { label: "Prettier", value: "esbenp.prettier-vscode", description: "Code formatter" },
        { label: "GitHub Copilot", value: "github.copilot", description: "AI pair programmer" },
      ],
    },
  };
}

/**
 * Common VS Code extensions available for all templates
 */
function getCommonExtensions(): SelectOption<string>[] {
  return [
    { label: "GitLens", value: "eamodio.gitlens", description: "Enhanced Git visualization" },
    { label: "Docker", value: "ms-azuretools.vscode-docker", description: "Docker integration" },
    { label: "Code Spell Checker", value: "streetsidesoftware.code-spell-checker", description: "Spelling checker" },
    { label: "GitHub Copilot", value: "github.copilot", description: "AI pair programmer" },
    { label: "Error Lens", value: "usernamehw.errorlens", description: "Inline error highlighting" },
    { label: "Todo Tree", value: "gruntfuggly.todo-tree", description: "Highlight TODO comments" },
    { label: "Bookmarks", value: "alefragnani.bookmarks", description: "Code bookmarks" },
    { label: "Live Share", value: "ms-vsliveshare.vsliveshare", description: "Real-time collaboration" },
  ];
}

/**
 * Common devcontainer features available for all templates
 */
function getCommonFeatures(): SelectOption<string>[] {
  return [
    { label: "Docker-in-Docker", value: "ghcr.io/devcontainers/features/docker-in-docker:2", description: "Run Docker inside container" },
    { label: "GitHub CLI", value: "ghcr.io/devcontainers/features/github-cli:1", description: "GitHub command-line tool" },
    { label: "AWS CLI", value: "ghcr.io/devcontainers/features/aws-cli:1", description: "Amazon Web Services CLI" },
    { label: "Azure CLI", value: "ghcr.io/devcontainers/features/azure-cli:1", description: "Microsoft Azure CLI" },
    { label: "kubectl", value: "ghcr.io/devcontainers/features/kubectl-helm-minikube:1", description: "Kubernetes tools" },
    { label: "Terraform", value: "ghcr.io/devcontainers/features/terraform:1", description: "Infrastructure as code" },
  ];
}

/**
 * Run the interactive wizard
 */
export async function runWizard(
  projectDir: string,
  options: { skipWelcome?: boolean } = {}
): Promise<CommandResult> {
  const devcontainerDir = join(projectDir, ".devcontainer");

  try {
    // Check if already initialized
    if (await exists(join(devcontainerDir, "sdc.json"))) {
      const overwrite = await promptConfirm(
        "Project already has a devcontainer config. Overwrite?",
        false
      );
      if (!overwrite) {
        return {
          success: false,
          message: "Wizard cancelled - existing configuration preserved",
        };
      }
    }

    // Print welcome message
    if (!options.skipWelcome) {
      printWelcome();
    }

    // Step 1: Project name
    printSection("Project Details");
    const defaultName = projectDir.split("/").pop() || "project";
    const projectName = await promptText("Project name", defaultName);

    // Step 2: Template selection
    printSection("Template Selection");
    const templateMetadata = getTemplateMetadata();
    const templates = listBuiltinTemplates();

    const templateOptions: SelectOption<string>[] = templates.map((t) => ({
      label: templateMetadata[t]?.displayName || t,
      value: t,
      description: templateMetadata[t]?.description || "",
    }));

    const selectedTemplate = await promptSelect(
      "Which template would you like to use?",
      templateOptions,
      0
    );

    const meta = templateMetadata[selectedTemplate];

    // Step 3: Runtime version (if applicable)
    let runtimeVersion: string | undefined;
    if (meta?.runtimeVersionPrompt) {
      printSection("Runtime Configuration");
      runtimeVersion = await promptSelect(
        meta.runtimeVersionPrompt.question,
        meta.runtimeVersionPrompt.options,
        0
      );
    }

    // Step 4: Port configuration
    printSection("Port Forwarding");
    printInfo("Specify ports to forward from the container to your host machine.");

    const defaultPorts = meta?.defaultPorts || [];
    const ports = await promptPorts(
      "Ports to forward (comma-separated)",
      defaultPorts
    );

    // Step 5: VS Code extensions
    printSection("VS Code Extensions");
    printInfo("Select additional extensions to install in the container.");

    // Combine template-specific and common extensions, removing duplicates
    const allExtensions = [
      ...(meta?.suggestedExtensions || []),
      ...getCommonExtensions().filter(
        (ext) => !meta?.suggestedExtensions?.some((s) => s.value === ext.value)
      ),
    ];

    // Default to first few suggested extensions
    const defaultExtensionIndices = meta?.suggestedExtensions
      ? Array.from({ length: Math.min(3, meta.suggestedExtensions.length) }, (_, i) => i)
      : [];

    const extensions = await promptMultiSelect(
      "Select VS Code extensions to add:",
      allExtensions,
      defaultExtensionIndices
    );

    // Step 6: Additional features
    printSection("Container Features");
    printInfo("Select additional devcontainer features to include.");

    const addFeatures = await promptConfirm(
      "Would you like to add additional container features?",
      false
    );

    let selectedFeatures: string[] = [];
    if (addFeatures) {
      selectedFeatures = await promptMultiSelect(
        "Select features to add:",
        getCommonFeatures(),
        []
      );
    }

    // Step 7: Environment variables
    printSection("Environment Variables");
    const addEnvVars = await promptConfirm(
      "Would you like to add environment variables?",
      false
    );

    const envVars: Record<string, string> = {};
    if (addEnvVars) {
      printInfo("Enter environment variables in KEY=VALUE format, comma-separated.");
      printInfo("Use ${localEnv:VAR_NAME} syntax to reference host environment variables.");
      const envList = await promptList(
        "Environment variables (e.g., NODE_ENV=development, API_KEY=${localEnv:API_KEY})"
      );

      for (const item of envList) {
        const [key, ...valueParts] = item.split("=");
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join("=").trim();
        }
      }
    }

    // Step 8: Post-create commands
    printSection("Post-Create Commands");
    printInfo("Commands to run after the container is created.");

    const defaultPostCreate = meta?.postCreateCommands || [];
    const postCreateCommands = await promptList(
      "Post-create commands (comma-separated)",
      defaultPostCreate
    );

    // Build project configuration
    printSection("Generating Configuration");

    const projectConfig: ProjectConfig = {
      name: projectName,
      extends: selectedTemplate,
      features: {},
      extensions: extensions,
      env: envVars,
      ports: ports,
      postCreateCommands: postCreateCommands,
    };

    // Add runtime version override if selected
    if (runtimeVersion && meta?.runtimeVersionPrompt) {
      projectConfig.features = {
        [meta.runtimeVersionPrompt.featureKey]: {
          [meta.runtimeVersionPrompt.featureVersion]: runtimeVersion,
        },
      };
    }

    // Add selected features
    for (const feature of selectedFeatures) {
      projectConfig.features![feature] = {};
    }

    // Load global config and template
    const globalConfig = await loadGlobalConfig();

    // Load the selected template
    const baseTemplate = await getBuiltinTemplate(selectedTemplate);
    const baseConfig: DevcontainerConfig = baseTemplate || createBaseConfig(globalConfig);

    // Create devcontainer directory
    await mkdir(devcontainerDir, { recursive: true });

    // Save project config (sdc.json)
    await saveProjectConfig(projectDir, projectConfig);
    printSuccess(`Created .devcontainer/sdc.json`);

    // Generate and save merged devcontainer.json
    const mergedConfig = mergeConfigs(baseConfig, projectConfig, globalConfig);
    await saveDevcontainerConfig(projectDir, mergedConfig);
    printSuccess(`Created .devcontainer/devcontainer.json`);

    // Print summary
    printSection("Configuration Complete!");
    console.log(`
  Project: ${projectName}
  Template: ${meta?.displayName || selectedTemplate}
  ${runtimeVersion ? `Runtime Version: ${runtimeVersion}` : ""}
  Ports: ${ports.length > 0 ? ports.join(", ") : "None"}
  Extensions: ${extensions.length}
  Environment Variables: ${Object.keys(envVars).length}
  Post-Create Commands: ${postCreateCommands.length}

  Next steps:
    1. Open this folder in VS Code
    2. Click "Reopen in Container" when prompted
       (or use the command palette: "Dev Containers: Reopen in Container")
    3. Edit .devcontainer/sdc.json to further customize your setup
    4. Run 'sdc update' to regenerate devcontainer.json after changes
`);

    return {
      success: true,
      message: `Successfully configured devcontainer for "${projectName}"`,
      data: {
        projectDir,
        devcontainerDir,
        projectConfig,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Wizard failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Quick wizard with minimal prompts (for experienced users)
 */
export async function runQuickWizard(
  projectDir: string,
  templateName?: string
): Promise<CommandResult> {
  const devcontainerDir = join(projectDir, ".devcontainer");

  try {
    // Check if already initialized
    if (await exists(join(devcontainerDir, "sdc.json"))) {
      return {
        success: false,
        message: "Project already initialized with shared-dev-containers",
      };
    }

    printSection("Quick Setup");

    // Project name
    const defaultName = projectDir.split("/").pop() || "project";
    const projectName = await promptText("Project name", defaultName);

    // Template selection (if not provided)
    let selectedTemplate = templateName;
    if (!selectedTemplate) {
      const templateMetadata = getTemplateMetadata();
      const templates = listBuiltinTemplates();

      const templateOptions: SelectOption<string>[] = templates.map((t) => ({
        label: templateMetadata[t]?.displayName || t,
        value: t,
        description: templateMetadata[t]?.description || "",
      }));

      selectedTemplate = await promptSelect(
        "Select template:",
        templateOptions,
        0
      );
    }

    const meta = getTemplateMetadata()[selectedTemplate];

    // Create minimal project config with defaults
    const projectConfig: ProjectConfig = {
      name: projectName,
      extends: selectedTemplate,
      features: {},
      extensions: [],
      env: {},
      ports: meta?.defaultPorts || [],
      postCreateCommands: meta?.postCreateCommands || [],
    };

    // Load configs and generate
    const globalConfig = await loadGlobalConfig();
    const baseTemplate = await getBuiltinTemplate(selectedTemplate);
    const baseConfig: DevcontainerConfig = baseTemplate || createBaseConfig(globalConfig);

    await mkdir(devcontainerDir, { recursive: true });
    await saveProjectConfig(projectDir, projectConfig);
    printSuccess(`Created .devcontainer/sdc.json`);

    const mergedConfig = mergeConfigs(baseConfig, projectConfig, globalConfig);
    await saveDevcontainerConfig(projectDir, mergedConfig);
    printSuccess(`Created .devcontainer/devcontainer.json`);

    console.log(`
  Quick setup complete for "${projectName}" using ${meta?.displayName || selectedTemplate} template.
  Run 'sdc wizard' to customize further options.
`);

    return {
      success: true,
      message: `Initialized project "${projectName}" with ${selectedTemplate} template`,
      data: { projectDir, devcontainerDir },
    };
  } catch (error) {
    return {
      success: false,
      message: `Quick wizard failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
