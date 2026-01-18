import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  loadGlobalConfig,
  saveGlobalConfig,
  exists,
} from "../utils/config.js";
import {
  syncRepository,
  verifyRepositoryAccess,
  listRemoteTemplates,
  getRemoteTemplate,
  getRepoCachePath,
  needsSync,
  detectAuthType,
} from "../utils/git.js";
import type {
  CommandResult,
  GitTemplateSource,
  RemoteTemplatesConfig,
  GitAuthType,
} from "../types/index.js";

/**
 * Default remote templates configuration
 */
const DEFAULT_REMOTE_CONFIG: RemoteTemplatesConfig = {
  repositories: [],
  cacheDir: join(homedir(), ".shared-dev-containers", "remote-cache"),
  autoSync: true,
  defaultSyncInterval: 24, // 24 hours
};

/**
 * Ensure remote templates configuration exists in global config
 */
async function ensureRemoteConfig(): Promise<RemoteTemplatesConfig> {
  const globalConfig = await loadGlobalConfig();

  if (!globalConfig.remoteTemplates) {
    globalConfig.remoteTemplates = { ...DEFAULT_REMOTE_CONFIG };
    await saveGlobalConfig(globalConfig);
  }

  // Ensure cache directory exists
  await mkdir(globalConfig.remoteTemplates.cacheDir, { recursive: true });

  return globalConfig.remoteTemplates;
}

/**
 * Add a remote Git repository as a template source
 */
export async function addRemoteRepository(
  name: string,
  url: string,
  options: {
    branch?: string;
    authType?: GitAuthType;
    credentials?: string;
    syncInterval?: number;
    templatesPath?: string;
  } = {}
): Promise<CommandResult> {
  try {
    const globalConfig = await loadGlobalConfig();
    const remoteConfig = globalConfig.remoteTemplates || { ...DEFAULT_REMOTE_CONFIG };

    // Check if repository with this name already exists
    if (remoteConfig.repositories.some((r) => r.name === name)) {
      return {
        success: false,
        message: `Remote repository "${name}" already exists. Use 'sdc repo update' to modify or 'sdc repo remove' to delete.`,
      };
    }

    // Detect auth type if not specified
    const authType = options.authType || detectAuthType(url);

    // Create the source configuration
    const source: GitTemplateSource = {
      name,
      url,
      branch: options.branch || "main",
      authType,
      credentials: options.credentials,
      syncInterval: options.syncInterval ?? remoteConfig.defaultSyncInterval,
      templatesPath: options.templatesPath,
    };

    // Verify repository access
    const verifyResult = await verifyRepositoryAccess(source);
    if (!verifyResult.success) {
      return {
        success: false,
        message: verifyResult.message,
      };
    }

    // Clone the repository
    const syncResult = await syncRepository(source);
    if (!syncResult.success) {
      return {
        success: false,
        message: syncResult.message,
      };
    }

    // Update last synced time
    source.lastSynced = new Date().toISOString();

    // Add to configuration
    remoteConfig.repositories.push(source);
    globalConfig.remoteTemplates = remoteConfig;
    await saveGlobalConfig(globalConfig);

    // List available templates
    const templates = await listRemoteTemplates(source);

    return {
      success: true,
      message: `Added remote repository "${name}" with ${templates.length} template(s)`,
      data: {
        name,
        url,
        templates,
        cachePath: getRepoCachePath(name),
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to add remote repository: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Remove a remote repository
 */
export async function removeRemoteRepository(name: string): Promise<CommandResult> {
  try {
    const globalConfig = await loadGlobalConfig();
    const remoteConfig = globalConfig.remoteTemplates;

    if (!remoteConfig) {
      return {
        success: false,
        message: "No remote repositories configured",
      };
    }

    const index = remoteConfig.repositories.findIndex((r) => r.name === name);
    if (index === -1) {
      return {
        success: false,
        message: `Remote repository "${name}" not found`,
      };
    }

    // Remove from configuration
    remoteConfig.repositories.splice(index, 1);
    await saveGlobalConfig(globalConfig);

    // Optionally clean up cache
    const cachePath = getRepoCachePath(name);
    if (await exists(cachePath)) {
      const { rm } = await import("node:fs/promises");
      await rm(cachePath, { recursive: true, force: true });
    }

    return {
      success: true,
      message: `Removed remote repository "${name}"`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to remove remote repository: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * List all configured remote repositories
 */
export async function listRemoteRepositories(): Promise<CommandResult> {
  try {
    const globalConfig = await loadGlobalConfig();
    const remoteConfig = globalConfig.remoteTemplates;

    if (!remoteConfig || remoteConfig.repositories.length === 0) {
      return {
        success: true,
        message: "No remote repositories configured",
        data: { repositories: [] },
      };
    }

    const repositories = await Promise.all(
      remoteConfig.repositories.map(async (repo) => {
        const templates = await listRemoteTemplates(repo);
        const needsSyncNow = needsSync(repo);

        return {
          name: repo.name,
          url: repo.url,
          branch: repo.branch || "main",
          authType: repo.authType || "none",
          templates,
          lastSynced: repo.lastSynced,
          needsSync: needsSyncNow,
          templatesPath: repo.templatesPath,
        };
      })
    );

    return {
      success: true,
      message: `Found ${repositories.length} remote repository(ies)`,
      data: { repositories },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list remote repositories: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Sync a specific remote repository or all repositories
 */
export async function syncRemoteRepositories(name?: string): Promise<CommandResult> {
  try {
    const globalConfig = await loadGlobalConfig();
    const remoteConfig = globalConfig.remoteTemplates;

    if (!remoteConfig || remoteConfig.repositories.length === 0) {
      return {
        success: true,
        message: "No remote repositories configured",
        data: { synced: [] },
      };
    }

    const reposToSync = name
      ? remoteConfig.repositories.filter((r) => r.name === name)
      : remoteConfig.repositories;

    if (name && reposToSync.length === 0) {
      return {
        success: false,
        message: `Remote repository "${name}" not found`,
      };
    }

    const results: Array<{
      name: string;
      success: boolean;
      message: string;
      hasChanges: boolean;
    }> = [];

    for (const repo of reposToSync) {
      const syncResult = await syncRepository(repo);

      // Update last synced time if successful
      if (syncResult.success) {
        repo.lastSynced = new Date().toISOString();
      }

      results.push({
        name: repo.name,
        success: syncResult.success,
        message: syncResult.message,
        hasChanges: syncResult.hasChanges || false,
      });
    }

    // Save updated config with new sync times
    await saveGlobalConfig(globalConfig);

    const successCount = results.filter((r) => r.success).length;
    const changedCount = results.filter((r) => r.hasChanges).length;

    return {
      success: results.every((r) => r.success),
      message: `Synced ${successCount}/${results.length} repositories, ${changedCount} had changes`,
      data: { results },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to sync remote repositories: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Get a template from a remote repository
 */
export async function getRemoteRepoTemplate(
  repoName: string,
  templateName: string
): Promise<CommandResult> {
  try {
    const globalConfig = await loadGlobalConfig();
    const remoteConfig = globalConfig.remoteTemplates;

    if (!remoteConfig) {
      return {
        success: false,
        message: "No remote repositories configured",
      };
    }

    const repo = remoteConfig.repositories.find((r) => r.name === repoName);
    if (!repo) {
      return {
        success: false,
        message: `Remote repository "${repoName}" not found`,
      };
    }

    // Auto-sync if needed
    if (globalConfig.remoteTemplates?.autoSync && needsSync(repo)) {
      await syncRepository(repo);
      repo.lastSynced = new Date().toISOString();
      await saveGlobalConfig(globalConfig);
    }

    const result = await getRemoteTemplate(repo, templateName);

    if (!result.success) {
      return {
        success: false,
        message: result.message,
      };
    }

    return {
      success: true,
      message: result.message,
      data: {
        repository: repoName,
        template: templateName,
        config: result.config,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get remote template: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * List all available remote templates across all repositories
 */
export async function listAllRemoteTemplates(): Promise<CommandResult> {
  try {
    const globalConfig = await loadGlobalConfig();
    const remoteConfig = globalConfig.remoteTemplates;

    if (!remoteConfig || remoteConfig.repositories.length === 0) {
      return {
        success: true,
        message: "No remote repositories configured",
        data: { templates: [] },
      };
    }

    const allTemplates: Array<{
      repository: string;
      template: string;
      fullName: string; // repo:template format
    }> = [];

    for (const repo of remoteConfig.repositories) {
      // Auto-sync if needed
      if (remoteConfig.autoSync && needsSync(repo)) {
        await syncRepository(repo);
        repo.lastSynced = new Date().toISOString();
      }

      const templates = await listRemoteTemplates(repo);
      for (const template of templates) {
        allTemplates.push({
          repository: repo.name,
          template,
          fullName: `${repo.name}:${template}`,
        });
      }
    }

    // Save updated sync times
    await saveGlobalConfig(globalConfig);

    return {
      success: true,
      message: `Found ${allTemplates.length} template(s) across ${remoteConfig.repositories.length} repository(ies)`,
      data: { templates: allTemplates },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list remote templates: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Update configuration for a remote repository
 */
export async function updateRemoteRepository(
  name: string,
  updates: {
    branch?: string;
    authType?: GitAuthType;
    credentials?: string;
    syncInterval?: number;
    templatesPath?: string;
  }
): Promise<CommandResult> {
  try {
    const globalConfig = await loadGlobalConfig();
    const remoteConfig = globalConfig.remoteTemplates;

    if (!remoteConfig) {
      return {
        success: false,
        message: "No remote repositories configured",
      };
    }

    const repo = remoteConfig.repositories.find((r) => r.name === name);
    if (!repo) {
      return {
        success: false,
        message: `Remote repository "${name}" not found`,
      };
    }

    // Apply updates
    if (updates.branch !== undefined) repo.branch = updates.branch;
    if (updates.authType !== undefined) repo.authType = updates.authType;
    if (updates.credentials !== undefined) repo.credentials = updates.credentials;
    if (updates.syncInterval !== undefined) repo.syncInterval = updates.syncInterval;
    if (updates.templatesPath !== undefined) repo.templatesPath = updates.templatesPath;

    await saveGlobalConfig(globalConfig);

    // If branch changed, force a sync
    if (updates.branch !== undefined) {
      const syncResult = await syncRepository(repo);
      if (syncResult.success) {
        repo.lastSynced = new Date().toISOString();
        await saveGlobalConfig(globalConfig);
      }
    }

    return {
      success: true,
      message: `Updated remote repository "${name}"`,
      data: { repository: repo },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to update remote repository: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Configure global remote template settings
 */
export async function configureRemoteSettings(settings: {
  autoSync?: boolean;
  defaultSyncInterval?: number;
}): Promise<CommandResult> {
  try {
    const globalConfig = await loadGlobalConfig();
    const remoteConfig = await ensureRemoteConfig();

    if (settings.autoSync !== undefined) {
      remoteConfig.autoSync = settings.autoSync;
    }

    if (settings.defaultSyncInterval !== undefined) {
      remoteConfig.defaultSyncInterval = settings.defaultSyncInterval;
    }

    globalConfig.remoteTemplates = remoteConfig;
    await saveGlobalConfig(globalConfig);

    return {
      success: true,
      message: "Updated remote template settings",
      data: {
        autoSync: remoteConfig.autoSync,
        defaultSyncInterval: remoteConfig.defaultSyncInterval,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to configure settings: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
