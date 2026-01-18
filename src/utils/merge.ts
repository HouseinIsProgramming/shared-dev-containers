import type { DevcontainerConfig, ProjectConfig, GlobalConfig, UserCustomizations } from "../types/index.js";

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
 * Apply user customizations to a devcontainer config
 * This includes dotfiles feature and shell config postCreateCommand
 */
export function applyUserCustomizations(
  config: DevcontainerConfig,
  customizations: UserCustomizations
): DevcontainerConfig {
  const result = { ...config };

  // Apply dotfiles feature (using devcontainer dotfiles feature)
  const dotfilesRepo = customizations.dotfilesRepo || customizations.dotfiles;
  if (dotfilesRepo) {
    result.features = result.features || {};

    // Build dotfiles feature configuration
    const dotfilesFeatureConfig: Record<string, unknown> = {
      repository: dotfilesRepo,
    };

    if (customizations.dotfilesTargetPath) {
      dotfilesFeatureConfig.targetPath = customizations.dotfilesTargetPath;
    }

    if (customizations.dotfilesInstallCommand) {
      dotfilesFeatureConfig.installCommand = customizations.dotfilesInstallCommand;
    }

    // Use the official devcontainer dotfiles feature
    result.features["ghcr.io/devcontainers/features/common-utils:2"] = {
      ...(result.features["ghcr.io/devcontainers/features/common-utils:2"] as Record<string, unknown> || {}),
    };

    // Dotfiles are configured at the devcontainer.json level, not as a feature
    // We'll use the native dotfiles configuration
    (result as unknown as Record<string, unknown>).dotfiles = {
      repository: dotfilesRepo,
      ...(customizations.dotfilesTargetPath && { targetPath: customizations.dotfilesTargetPath }),
      ...(customizations.dotfilesInstallCommand && { installCommand: customizations.dotfilesInstallCommand }),
    };
  }

  // Apply shell config via postCreateCommand
  const shellConfigSource = customizations.shellConfigSource || customizations.shellConfig;
  if (shellConfigSource) {
    const shellConfigTarget = customizations.shellConfigTarget || "~/.zshrc";

    // Create command to copy shell config
    // The source file should be mounted or copied to a known location
    const shellConfigCommand = `if [ -f "${shellConfigSource}" ]; then cp "${shellConfigSource}" "${shellConfigTarget}" && echo "Applied shell config from ${shellConfigSource}"; fi`;

    // Add to postCreateCommand
    const existingCommands = Array.isArray(result.postCreateCommand)
      ? result.postCreateCommand
      : result.postCreateCommand
        ? [result.postCreateCommand]
        : [];

    result.postCreateCommand = [...existingCommands, shellConfigCommand];
  }

  // Apply custom environment variables
  if (customizations.customEnvVars && Object.keys(customizations.customEnvVars).length > 0) {
    result.containerEnv = {
      ...(result.containerEnv || {}),
      ...customizations.customEnvVars,
    };
  }

  return result;
}

/**
 * Merge project config with base template to produce final devcontainer config
 */
export function mergeConfigs(
  baseConfig: DevcontainerConfig,
  projectConfig: ProjectConfig,
  globalConfig: GlobalConfig
): DevcontainerConfig {
  let result = { ...baseConfig };

  // Apply user customizations from global config first (lowest priority)
  if (globalConfig.userCustomizations) {
    result = applyUserCustomizations(result, globalConfig.userCustomizations);
  }

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
 *
 * This function creates a base configuration that includes:
 * - Default image and features from global config
 * - Standard VS Code extensions and settings
 * - User customizations (dotfiles, shell config, env vars) from global config
 */
export function createBaseConfig(globalConfig: GlobalConfig): DevcontainerConfig {
  // Start with the basic configuration
  let config: DevcontainerConfig = {
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

  // Apply user customizations from global config if present
  if (globalConfig.userCustomizations) {
    config = applyUserCustomizations(config, globalConfig.userCustomizations);
  }

  return config;
}
