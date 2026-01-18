import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  loadGlobalConfig,
  saveGlobalConfig,
  loadProjectConfig,
  saveProjectConfig,
  saveDevcontainerConfig,
  exists,
  getConfigDir,
  readDevcontainerConfigRaw,
  serializeConfig,
  getDevcontainerConfigPath,
} from "../utils/config.js";
import { createBaseConfig, mergeConfigs } from "../utils/merge.js";
import { createFileDiff, hasChanges } from "../utils/diff.js";
import { analyzeProject, formatAnalysisResult } from "../utils/analyzer.js";
import type { ProjectConfig, CommandResult, DryRunOptions, DryRunResult, ProjectAnalysis } from "../types/index.js";

/**
 * Initialize global shared-dev-containers configuration
 */
export async function initGlobal(): Promise<CommandResult> {
  const configDir = getConfigDir();
  const templatesDir = join(configDir, "templates");

  try {
    // Create directories
    await mkdir(configDir, { recursive: true });
    await mkdir(templatesDir, { recursive: true });

    // Load or create global config
    const config = await loadGlobalConfig();
    await saveGlobalConfig(config);

    // Create default base template
    const baseConfig = createBaseConfig(config);
    await saveDevcontainerConfig(templatesDir, baseConfig);

    return {
      success: true,
      message: `Initialized shared-dev-containers at ${configDir}`,
      data: { configDir, templatesDir },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Initialize a project with shared devcontainer configuration
 */
export async function initProject(
  projectDir: string,
  options: { name?: string; template?: string; auto?: boolean } = {}
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

    // Load global config
    const globalConfig = await loadGlobalConfig();

    // Auto-detect project type if --auto flag is set and no template is specified
    let analysis: ProjectAnalysis | undefined;
    let template = options.template;
    let suggestedExtensions: string[] = [];
    let suggestedPorts: number[] = [];
    let suggestedCommands: string[] = [];

    if (options.auto && !options.template) {
      analysis = await analyzeProject(projectDir);
      template = analysis.recommendedTemplate;
      suggestedExtensions = analysis.suggestedCustomizations.extensions || [];
      suggestedPorts = analysis.suggestedCustomizations.ports || [];
      suggestedCommands = analysis.suggestedCustomizations.postCreateCommands || [];
    }

    // Create project config
    const projectName = options.name || projectDir.split("/").pop() || "project";
    const projectConfig: ProjectConfig = {
      name: projectName,
      extends: template || "base",
      features: {},
      extensions: suggestedExtensions,
      env: {},
      ports: suggestedPorts,
      postCreateCommands: suggestedCommands,
    };

    // Create devcontainer directory
    await mkdir(devcontainerDir, { recursive: true });

    // Save project config
    await saveProjectConfig(projectDir, projectConfig);

    // Generate and save devcontainer.json
    const baseConfig = createBaseConfig(globalConfig);
    const mergedConfig = mergeConfigs(baseConfig, projectConfig, globalConfig);
    await saveDevcontainerConfig(projectDir, mergedConfig);

    // Build result message
    let message = `Initialized project "${projectName}" with shared devcontainer`;
    if (analysis) {
      message += ` (auto-detected: ${analysis.projectType}, template: ${analysis.recommendedTemplate})`;
    }

    return {
      success: true,
      message,
      data: { projectDir, devcontainerDir, analysis },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to initialize project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Analyze a project and suggest the best template and customizations
 */
export async function analyzeProjectCommand(
  projectDir: string
): Promise<CommandResult<{ analysis: ProjectAnalysis }>> {
  try {
    const analysis = await analyzeProject(projectDir);

    return {
      success: true,
      message: formatAnalysisResult(analysis),
      data: { analysis },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to analyze project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Update project devcontainer from base template and project config
 */
export async function updateProject(
  projectDir: string,
  options: DryRunOptions = {}
): Promise<CommandResult> {
  try {
    // Load project config
    const projectConfig = await loadProjectConfig(projectDir);
    if (!projectConfig) {
      return {
        success: false,
        message: "Project not initialized with shared-dev-containers. Run 'sdc init' first.",
      };
    }

    // Load global config
    const globalConfig = await loadGlobalConfig();

    // Generate merged devcontainer.json
    const baseConfig = createBaseConfig(globalConfig);
    const mergedConfig = mergeConfigs(baseConfig, projectConfig, globalConfig);
    const newContent = serializeConfig(mergedConfig);

    // If dry-run mode, compare and return diff
    if (options.dryRun) {
      const oldContent = await readDevcontainerConfigRaw(projectDir);
      const configPath = getDevcontainerConfigPath(projectDir);
      const diff = createFileDiff(configPath, oldContent, newContent);
      const wouldChange = hasChanges(diff);

      const dryRunResult: DryRunResult = {
        project: projectConfig.name,
        path: projectDir,
        wouldChange,
        diffs: [diff],
      };

      return {
        success: true,
        message: wouldChange
          ? `[DRY-RUN] Would update devcontainer.json for "${projectConfig.name}"`
          : `[DRY-RUN] No changes needed for "${projectConfig.name}"`,
        data: { dryRun: true, result: dryRunResult },
      };
    }

    // Actually save the file
    await saveDevcontainerConfig(projectDir, mergedConfig);

    return {
      success: true,
      message: `Updated devcontainer.json for "${projectConfig.name}"`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to update project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
