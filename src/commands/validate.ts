/**
 * Validate command for shared-dev-containers
 *
 * Scans for conflicts between base template requirements and project customizations,
 * and suggests automatic resolutions.
 */

import { join } from "node:path";
import {
  loadGlobalConfig,
  loadProjectConfig,
  saveProjectConfig,
  saveDevcontainerConfig,
  exists,
} from "../utils/config.js";
import { createBaseConfig, mergeConfigs } from "../utils/merge.js";
import {
  detectConflicts,
  formatConflictReport,
  hasBlockingConflicts,
} from "../utils/conflict-detector.js";
import { getBuiltinTemplate } from "../templates/index.js";
import type { CommandResult, ConflictDetectionResult } from "../types/index.js";

/**
 * Validate a project's configuration against its base template
 */
export async function validateProject(
  projectDir: string
): Promise<CommandResult<{ result: ConflictDetectionResult }>> {
  try {
    // Check if project is initialized
    const projectConfig = await loadProjectConfig(projectDir);
    if (!projectConfig) {
      return {
        success: false,
        message: "Project not initialized with shared-dev-containers. Run 'sdc init' first.",
      };
    }

    // Load global config
    const globalConfig = await loadGlobalConfig();

    // Get base template config
    let baseConfig = createBaseConfig(globalConfig);

    // If project extends a specific template, try to load it
    if (projectConfig.extends && projectConfig.extends !== "base") {
      const template = await getBuiltinTemplate(projectConfig.extends);
      if (template) {
        baseConfig = template;
      }
    }

    // Detect conflicts
    const result = detectConflicts(baseConfig, projectConfig);

    // Format and return report
    const report = formatConflictReport(result);

    return {
      success: !hasBlockingConflicts(result),
      message: report,
      data: { result },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to validate project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Apply auto-fixable resolutions to a project
 */
export async function autoResolveConflicts(
  projectDir: string
): Promise<CommandResult<{ resolved: number; remaining: number }>> {
  try {
    // First, run validation to get conflicts
    const validationResult = await validateProject(projectDir);

    if (!validationResult.data?.result) {
      return {
        success: false,
        message: validationResult.message,
      };
    }

    const { result } = validationResult.data;

    if (!result.hasConflicts) {
      return {
        success: true,
        message: "No conflicts to resolve.",
        data: { resolved: 0, remaining: 0 },
      };
    }

    // Load project config for modifications
    const projectConfig = await loadProjectConfig(projectDir);
    if (!projectConfig) {
      return {
        success: false,
        message: "Project not initialized with shared-dev-containers.",
      };
    }

    let resolved = 0;
    const modifiedConfig = { ...projectConfig };

    // Apply auto-fixable resolutions
    for (const conflict of result.conflicts) {
      const autoResolution = result.resolutions.find(
        (r) => r.conflictId === conflict.id && r.autoApplicable && r.action === "use_base"
      );

      if (!autoResolution) continue;

      switch (conflict.category) {
        case "port":
          // Remove duplicate port from project config
          if (modifiedConfig.ports && conflict.projectValue !== undefined) {
            const portToRemove = conflict.projectValue as number;
            modifiedConfig.ports = modifiedConfig.ports.filter((p) => p !== portToRemove);
            resolved++;
          }
          break;

        case "environment":
          // Remove conflicting env var (use base)
          if (modifiedConfig.env && conflict.field) {
            const envKey = conflict.field.replace("env.", "");
            if (envKey in modifiedConfig.env) {
              delete modifiedConfig.env[envKey];
              resolved++;
            }
          }
          break;

        case "version":
          // Update feature version to match base
          if (modifiedConfig.features && conflict.field && autoResolution.suggestedValue) {
            const fieldParts = conflict.field.split(".");
            if (fieldParts[0] === "features" && fieldParts.length >= 3) {
              const featureKey = fieldParts[1];
              if (modifiedConfig.features[featureKey]) {
                (modifiedConfig.features[featureKey] as Record<string, unknown>).version =
                  autoResolution.suggestedValue;
                resolved++;
              }
            }
          }
          break;

        default:
          // Other categories may not have simple auto-fixes
          break;
      }
    }

    // Save modified config if any changes were made
    if (resolved > 0) {
      await saveProjectConfig(projectDir, modifiedConfig);

      // Regenerate devcontainer.json
      const globalConfig = await loadGlobalConfig();
      let baseConfig = createBaseConfig(globalConfig);

      if (modifiedConfig.extends && modifiedConfig.extends !== "base") {
        const template = await getBuiltinTemplate(modifiedConfig.extends);
        if (template) {
          baseConfig = template;
        }
      }

      const mergedConfig = mergeConfigs(baseConfig, modifiedConfig, globalConfig);
      await saveDevcontainerConfig(projectDir, mergedConfig);
    }

    const remaining = result.conflicts.length - resolved;

    return {
      success: true,
      message: `Resolved ${resolved} conflict(s). ${remaining} conflict(s) require manual review.`,
      data: { resolved, remaining },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to auto-resolve conflicts: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validate all projects in a directory
 */
export async function validateAllProjects(
  rootDir: string,
  maxDepth: number = 3
): Promise<
  CommandResult<{
    results: Array<{
      project: string;
      path: string;
      hasConflicts: boolean;
      errors: number;
      warnings: number;
    }>;
  }>
> {
  try {
    const results: Array<{
      project: string;
      path: string;
      hasConflicts: boolean;
      errors: number;
      warnings: number;
    }> = [];

    await validateDirectory(rootDir, results, maxDepth, 0);

    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings, 0);
    const projectsWithConflicts = results.filter((r) => r.hasConflicts).length;

    return {
      success: totalErrors === 0,
      message: `Validated ${results.length} project(s). ${projectsWithConflicts} with conflicts (${totalErrors} errors, ${totalWarnings} warnings).`,
      data: { results },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to validate projects: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Recursively validate projects in a directory
 */
async function validateDirectory(
  dir: string,
  results: Array<{
    project: string;
    path: string;
    hasConflicts: boolean;
    errors: number;
    warnings: number;
  }>,
  maxDepth: number,
  currentDepth: number
): Promise<void> {
  if (currentDepth > maxDepth) return;

  const { readdir } = await import("node:fs/promises");

  // Check if this directory is an sdc project
  const sdcConfigPath = join(dir, ".devcontainer", "sdc.json");
  if (await exists(sdcConfigPath)) {
    const projectConfig = await loadProjectConfig(dir);
    if (projectConfig) {
      const validationResult = await validateProject(dir);

      results.push({
        project: projectConfig.name,
        path: dir,
        hasConflicts: validationResult.data?.result?.hasConflicts ?? false,
        errors: validationResult.data?.result?.summary.errors ?? 0,
        warnings: validationResult.data?.result?.summary.warnings ?? 0,
      });
    }
    return; // Don't recurse into project subdirectories
  }

  // Recurse into subdirectories
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

      await validateDirectory(join(dir, entry.name), results, maxDepth, currentDepth + 1);
    }
  } catch {
    // Ignore directories we can't read
  }
}
