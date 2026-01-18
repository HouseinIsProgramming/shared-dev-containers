import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { GlobalConfig, ProjectConfig, DevcontainerConfig, UserCustomizations } from "../types/index.js";

/**
 * Default global configuration
 */
export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  templatesDir: join(homedir(), ".shared-dev-containers", "templates"),
  defaultImage: "mcr.microsoft.com/devcontainers/base:ubuntu",
  defaultFeatures: {
    "ghcr.io/devcontainers/features/common-utils:2": {
      installZsh: true,
      configureZshAsDefaultShell: true,
      installOhMyZsh: true,
      upgradePackages: true,
    },
    "ghcr.io/devcontainers/features/git:1": {},
  },
};

/**
 * Get the global config directory path
 */
export function getConfigDir(): string {
  return join(homedir(), ".shared-dev-containers");
}

/**
 * Get the global config file path
 */
export function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

/**
 * Check if a file or directory exists
 */
export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load the global configuration
 */
export async function loadGlobalConfig(): Promise<GlobalConfig> {
  const configPath = getConfigPath();

  if (!(await exists(configPath))) {
    return DEFAULT_GLOBAL_CONFIG;
  }

  try {
    const content = await readFile(configPath, "utf-8");
    const config = JSON.parse(content) as Partial<GlobalConfig>;
    return { ...DEFAULT_GLOBAL_CONFIG, ...config };
  } catch (error) {
    console.error("Failed to load global config:", error);
    return DEFAULT_GLOBAL_CONFIG;
  }
}

/**
 * Save the global configuration
 */
export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
  const configPath = getConfigPath();
  const configDir = getConfigDir();

  await mkdir(configDir, { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Save user customizations to the global configuration
 *
 * This helper loads the current global config, merges the provided customizations,
 * and saves the updated config. Use this instead of manually loading/saving when
 * only updating user customizations.
 *
 * @param customizations - Partial UserCustomizations to merge with existing ones
 * @param options - Options for how to handle the update
 * @param options.replace - If true, replace all customizations instead of merging (default: false)
 * @returns The updated UserCustomizations object
 */
export async function saveUserCustomizations(
  customizations: Partial<UserCustomizations>,
  options: { replace?: boolean } = {}
): Promise<UserCustomizations> {
  const globalConfig = await loadGlobalConfig();

  let updatedCustomizations: UserCustomizations;

  if (options.replace) {
    // Replace mode: use provided customizations directly
    updatedCustomizations = customizations as UserCustomizations;
  } else {
    // Merge mode: deep merge with existing customizations
    const existingCustomizations = globalConfig.userCustomizations || {};

    // Handle customEnvVars specially - merge the nested object
    const mergedEnvVars = {
      ...existingCustomizations.customEnvVars,
      ...customizations.customEnvVars,
    };

    updatedCustomizations = {
      ...existingCustomizations,
      ...customizations,
    };

    // Only include customEnvVars if there are any
    if (Object.keys(mergedEnvVars).length > 0) {
      updatedCustomizations.customEnvVars = mergedEnvVars;
    } else if (customizations.customEnvVars === undefined && existingCustomizations.customEnvVars === undefined) {
      // Neither had envVars, don't add empty object
      delete updatedCustomizations.customEnvVars;
    }
  }

  const updatedConfig: GlobalConfig = {
    ...globalConfig,
    userCustomizations: updatedCustomizations,
  };

  await saveGlobalConfig(updatedConfig);

  return updatedCustomizations;
}

/**
 * Get the current user customizations from global config
 *
 * @returns The current UserCustomizations or an empty object if none exist
 */
export async function getUserCustomizations(): Promise<UserCustomizations> {
  const globalConfig = await loadGlobalConfig();
  return globalConfig.userCustomizations || {};
}

/**
 * Clear all user customizations from global config
 *
 * @returns true if customizations were cleared, false if there were none
 */
export async function clearUserCustomizations(): Promise<boolean> {
  const globalConfig = await loadGlobalConfig();

  if (!globalConfig.userCustomizations || Object.keys(globalConfig.userCustomizations).length === 0) {
    return false;
  }

  const updatedConfig: GlobalConfig = {
    ...globalConfig,
    userCustomizations: {},
  };

  await saveGlobalConfig(updatedConfig);
  return true;
}

/**
 * Load project configuration from current directory
 */
export async function loadProjectConfig(projectDir: string): Promise<ProjectConfig | null> {
  const configPath = join(projectDir, ".devcontainer", "sdc.json");

  if (!(await exists(configPath))) {
    return null;
  }

  try {
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content) as ProjectConfig;
  } catch (error) {
    console.error("Failed to load project config:", error);
    return null;
  }
}

/**
 * Save project configuration
 */
export async function saveProjectConfig(projectDir: string, config: ProjectConfig): Promise<void> {
  const devcontainerDir = join(projectDir, ".devcontainer");
  const configPath = join(devcontainerDir, "sdc.json");

  await mkdir(devcontainerDir, { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Load devcontainer.json from a directory
 */
export async function loadDevcontainerConfig(projectDir: string): Promise<DevcontainerConfig | null> {
  const configPath = join(projectDir, ".devcontainer", "devcontainer.json");

  if (!(await exists(configPath))) {
    return null;
  }

  try {
    const content = await readFile(configPath, "utf-8");
    // Remove comments from JSON (devcontainer.json supports JSONC)
    const jsonContent = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    return JSON.parse(jsonContent) as DevcontainerConfig;
  } catch (error) {
    console.error("Failed to load devcontainer.json:", error);
    return null;
  }
}

/**
 * Save devcontainer.json
 */
export async function saveDevcontainerConfig(
  projectDir: string,
  config: DevcontainerConfig
): Promise<void> {
  const devcontainerDir = join(projectDir, ".devcontainer");
  const configPath = join(devcontainerDir, "devcontainer.json");

  await mkdir(devcontainerDir, { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Get the path to the devcontainer.json file
 */
export function getDevcontainerConfigPath(projectDir: string): string {
  return join(projectDir, ".devcontainer", "devcontainer.json");
}

/**
 * Convert a DevcontainerConfig to JSON string (for comparison purposes)
 */
export function serializeConfig(config: DevcontainerConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Read the raw content of devcontainer.json as a string
 */
export async function readDevcontainerConfigRaw(projectDir: string): Promise<string | null> {
  const configPath = getDevcontainerConfigPath(projectDir);

  if (!(await exists(configPath))) {
    return null;
  }

  try {
    return await readFile(configPath, "utf-8");
  } catch {
    return null;
  }
}
