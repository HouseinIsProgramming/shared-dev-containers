import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadProjectConfig, exists } from "../utils/config.js";
import { updateProject } from "./init.js";
import type { CommandResult, DryRunOptions, DryRunResult } from "../types/index.js";

/**
 * Sync result for a single project
 */
interface ProjectSyncResult {
  project: string;
  path: string;
  success: boolean;
  message: string;
}

/**
 * Sync all projects in a directory to use the latest base template
 */
export async function syncProjects(rootDir: string): Promise<CommandResult> {
  try {
    const results: ProjectSyncResult[] = [];
    await syncDirectory(rootDir, results);

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return {
      success: failCount === 0,
      message: `Synced ${successCount} project(s), ${failCount} failed`,
      data: { results },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to sync projects: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Recursively find and sync projects in a directory
 */
async function syncDirectory(
  dir: string,
  results: ProjectSyncResult[],
  maxDepth: number = 3,
  currentDepth: number = 0
): Promise<void> {
  if (currentDepth > maxDepth) {
    return;
  }

  // Check if this directory is a project with sdc.json
  const sdcConfigPath = join(dir, ".devcontainer", "sdc.json");
  if (await exists(sdcConfigPath)) {
    const projectConfig = await loadProjectConfig(dir);
    const projectName = projectConfig?.name || dir.split("/").pop() || "unknown";

    const result = await updateProject(dir);
    results.push({
      project: projectName,
      path: dir,
      success: result.success,
      message: result.message,
    });
    return; // Don't recurse into projects
  }

  // Recursively check subdirectories
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        entry.name !== "node_modules"
      ) {
        await syncDirectory(join(dir, entry.name), results, maxDepth, currentDepth + 1);
      }
    }
  } catch {
    // Ignore directories we can't read
  }
}

/**
 * Check if projects need syncing (have outdated devcontainer.json)
 */
export async function checkSync(rootDir: string): Promise<CommandResult> {
  try {
    const projects: Array<{ name: string; path: string; needsSync: boolean }> = [];
    await checkDirectory(rootDir, projects);

    const needsSync = projects.filter((p) => p.needsSync);

    return {
      success: true,
      message: `Found ${projects.length} project(s), ${needsSync.length} need syncing`,
      data: { projects, needsSync },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to check sync status: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Recursively check sync status of projects
 */
async function checkDirectory(
  dir: string,
  projects: Array<{ name: string; path: string; needsSync: boolean }>,
  maxDepth: number = 3,
  currentDepth: number = 0
): Promise<void> {
  if (currentDepth > maxDepth) {
    return;
  }

  const sdcConfigPath = join(dir, ".devcontainer", "sdc.json");
  if (await exists(sdcConfigPath)) {
    const projectConfig = await loadProjectConfig(dir);
    const projectName = projectConfig?.name || dir.split("/").pop() || "unknown";

    // For now, assume needs sync if sdc.json exists
    // In the future, we could compare timestamps or checksums
    projects.push({
      name: projectName,
      path: dir,
      needsSync: true, // Simplified - always suggest sync
    });
    return;
  }

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        entry.name !== "node_modules"
      ) {
        await checkDirectory(join(dir, entry.name), projects, maxDepth, currentDepth + 1);
      }
    }
  } catch {
    // Ignore directories we can't read
  }
}
