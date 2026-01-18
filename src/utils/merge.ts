import type { DevcontainerConfig, ProjectConfig, GlobalConfig } from "../types/index.js";

/**
 * Deep merge two objects
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (sourceValue === undefined) {
      continue;
    }

    if (Array.isArray(sourceValue)) {
      // For arrays, concatenate and deduplicate
      if (Array.isArray(targetValue)) {
        result[key] = [...new Set([...targetValue, ...sourceValue])] as T[keyof T];
      } else {
        result[key] = sourceValue as T[keyof T];
      }
    } else if (
      typeof sourceValue === "object" &&
      sourceValue !== null &&
      typeof targetValue === "object" &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      // Recursively merge objects
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Merge project config with base template to produce final devcontainer config
 */
export function mergeConfigs(
  baseConfig: DevcontainerConfig,
  projectConfig: ProjectConfig,
  _globalConfig: GlobalConfig
): DevcontainerConfig {
  let result = { ...baseConfig };

  // Merge features
  if (projectConfig.features) {
    result.features = deepMerge(result.features || {}, projectConfig.features);
  }

  // Merge VS Code extensions
  if (projectConfig.extensions) {
    result.customizations = result.customizations || {};
    result.customizations.vscode = result.customizations.vscode || {};
    result.customizations.vscode.extensions = [
      ...new Set([
        ...(result.customizations.vscode.extensions || []),
        ...projectConfig.extensions,
      ]),
    ];
  }

  // Merge environment variables
  if (projectConfig.env) {
    result.containerEnv = { ...(result.containerEnv || {}), ...projectConfig.env };
  }

  // Merge forwarded ports
  if (projectConfig.ports) {
    result.forwardPorts = [
      ...new Set([...(result.forwardPorts || []), ...projectConfig.ports]),
    ];
  }

  // Merge post-create commands
  if (projectConfig.postCreateCommands && projectConfig.postCreateCommands.length > 0) {
    const existingCommands = Array.isArray(result.postCreateCommand)
      ? result.postCreateCommand
      : result.postCreateCommand
        ? [result.postCreateCommand]
        : [];
    result.postCreateCommand = [...existingCommands, ...projectConfig.postCreateCommands];
  }

  // Apply custom overrides last (highest priority)
  if (projectConfig.overrides) {
    const merged = deepMerge(
      result as unknown as Record<string, unknown>,
      projectConfig.overrides as unknown as Record<string, unknown>
    );
    result = merged as unknown as DevcontainerConfig;
  }

  // Set name from project
  result.name = projectConfig.name;

  return result;
}

/**
 * Create a base devcontainer config from global settings
 */
export function createBaseConfig(globalConfig: GlobalConfig): DevcontainerConfig {
  return {
    name: "shared-dev-container",
    image: globalConfig.defaultImage,
    features: globalConfig.defaultFeatures,
    customizations: {
      vscode: {
        extensions: [
          "ms-azuretools.vscode-docker",
          "eamodio.gitlens",
          "esbenp.prettier-vscode",
        ],
        settings: {
          "terminal.integrated.defaultProfile.linux": "zsh",
        },
      },
    },
    remoteUser: "vscode",
  };
}
