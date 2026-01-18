import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { GlobalConfig, ProjectConfig, DevcontainerConfig } from "../types/index.js";

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
