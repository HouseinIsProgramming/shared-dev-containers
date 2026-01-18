import { homedir } from "node:os";
import { resolve } from "node:path";
import { access } from "node:fs/promises";
import { loadGlobalConfig, saveGlobalConfig } from "../utils/config.js";
import type { CommandResult, UserCustomizations, GlobalConfig } from "../types/index.js";

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a path, expanding ~ to home directory
 */
function resolvePath(inputPath: string): string {
  if (inputPath.startsWith("~")) {
    return resolve(homedir(), inputPath.slice(2));
  }
  return resolve(inputPath);
}

/**
 * Validate a Git repository URL
 */
function isValidGitUrl(url: string): boolean {
  // Support HTTPS URLs
  if (url.startsWith("https://") && url.endsWith(".git")) {
    return true;
  }
  // Support SSH URLs (git@host:user/repo.git)
  if (url.match(/^git@[\w.-]+:[\w./-]+\.git$/)) {
    return true;
  }
  // Support SSH URLs (ssh://git@host/user/repo.git)
  if (url.startsWith("ssh://") && url.endsWith(".git")) {
    return true;
  }
  return false;
}

/**
 * Add or update dotfiles repository configuration
 */
export async function setDotfilesRepo(
  repoUrl: string,
  options: {
    targetPath?: string;
    installCommand?: string;
  } = {}
): Promise<CommandResult> {
  try {
    if (!isValidGitUrl(repoUrl)) {
      return {
        success: false,
        message: `Invalid Git repository URL: "${repoUrl}". Expected format: https://github.com/user/repo.git or git@github.com:user/repo.git`,
      };
    }

    const globalConfig = await loadGlobalConfig();
    const userCustomizations: UserCustomizations = globalConfig.userCustomizations || {};

    userCustomizations.dotfilesRepo = repoUrl;

    if (options.targetPath) {
      userCustomizations.dotfilesTargetPath = options.targetPath;
    }

    if (options.installCommand) {
      userCustomizations.dotfilesInstallCommand = options.installCommand;
    }

    const updatedConfig: GlobalConfig = {
      ...globalConfig,
      userCustomizations,
    };

    await saveGlobalConfig(updatedConfig);

    let message = `Dotfiles repository configured: ${repoUrl}`;
    if (options.targetPath) {
      message += `\n  Target path: ${options.targetPath}`;
    }
    if (options.installCommand) {
      message += `\n  Install command: ${options.installCommand}`;
    }

    return {
      success: true,
      message,
      data: {
        dotfilesRepo: repoUrl,
        dotfilesTargetPath: options.targetPath,
        dotfilesInstallCommand: options.installCommand,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to configure dotfiles: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Remove dotfiles repository configuration
 */
export async function removeDotfilesRepo(): Promise<CommandResult> {
  try {
    const globalConfig = await loadGlobalConfig();

    if (!globalConfig.userCustomizations?.dotfilesRepo) {
      return {
        success: false,
        message: "No dotfiles repository configured",
      };
    }

    const userCustomizations: UserCustomizations = { ...globalConfig.userCustomizations };
    delete userCustomizations.dotfilesRepo;
    delete userCustomizations.dotfilesTargetPath;
    delete userCustomizations.dotfilesInstallCommand;
    // Also remove deprecated field if present
    delete userCustomizations.dotfiles;

    const updatedConfig: GlobalConfig = {
      ...globalConfig,
      userCustomizations,
    };

    await saveGlobalConfig(updatedConfig);

    return {
      success: true,
      message: "Dotfiles repository configuration removed",
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to remove dotfiles configuration: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Add or update shell configuration source
 */
export async function setShellConfig(
  sourcePath: string,
  options: {
    targetPath?: string;
  } = {}
): Promise<CommandResult> {
  try {
    const resolvedPath = resolvePath(sourcePath);

    if (!(await fileExists(resolvedPath))) {
      return {
        success: false,
        message: `Shell configuration file not found: "${resolvedPath}"`,
      };
    }

    const globalConfig = await loadGlobalConfig();
    const userCustomizations: UserCustomizations = globalConfig.userCustomizations || {};

    userCustomizations.shellConfigSource = resolvedPath;

    if (options.targetPath) {
      userCustomizations.shellConfigTarget = options.targetPath;
    }

    const updatedConfig: GlobalConfig = {
      ...globalConfig,
      userCustomizations,
    };

    await saveGlobalConfig(updatedConfig);

    let message = `Shell configuration configured: ${resolvedPath}`;
    if (options.targetPath) {
      message += `\n  Target path: ${options.targetPath}`;
    } else {
      message += `\n  Target path: ~/.zshrc (default)`;
    }

    return {
      success: true,
      message,
      data: {
        shellConfigSource: resolvedPath,
        shellConfigTarget: options.targetPath || "~/.zshrc",
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to configure shell config: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Remove shell configuration
 */
export async function removeShellConfig(): Promise<CommandResult> {
  try {
    const globalConfig = await loadGlobalConfig();

    if (!globalConfig.userCustomizations?.shellConfigSource) {
      return {
        success: false,
        message: "No shell configuration configured",
      };
    }

    const userCustomizations: UserCustomizations = { ...globalConfig.userCustomizations };
    delete userCustomizations.shellConfigSource;
    delete userCustomizations.shellConfigTarget;
    // Also remove deprecated field if present
    delete userCustomizations.shellConfig;

    const updatedConfig: GlobalConfig = {
      ...globalConfig,
      userCustomizations,
    };

    await saveGlobalConfig(updatedConfig);

    return {
      success: true,
      message: "Shell configuration removed",
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to remove shell configuration: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Add or update a custom environment variable
 */
export async function setEnvVar(name: string, value: string): Promise<CommandResult> {
  try {
    if (!name || !name.match(/^[A-Za-z_][A-Za-z0-9_]*$/)) {
      return {
        success: false,
        message: `Invalid environment variable name: "${name}". Must start with a letter or underscore and contain only alphanumeric characters and underscores.`,
      };
    }

    const globalConfig = await loadGlobalConfig();
    const userCustomizations: UserCustomizations = globalConfig.userCustomizations || {};
    const customEnvVars: Record<string, string> = userCustomizations.customEnvVars || {};

    customEnvVars[name] = value;
    userCustomizations.customEnvVars = customEnvVars;

    const updatedConfig: GlobalConfig = {
      ...globalConfig,
      userCustomizations,
    };

    await saveGlobalConfig(updatedConfig);

    return {
      success: true,
      message: `Environment variable set: ${name}="${value}"`,
      data: { name, value },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to set environment variable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Remove a custom environment variable
 */
export async function removeEnvVar(name: string): Promise<CommandResult> {
  try {
    const globalConfig = await loadGlobalConfig();

    if (!globalConfig.userCustomizations?.customEnvVars?.[name]) {
      return {
        success: false,
        message: `Environment variable "${name}" not found in customizations`,
      };
    }

    const userCustomizations: UserCustomizations = { ...globalConfig.userCustomizations };
    const customEnvVars: Record<string, string> = { ...userCustomizations.customEnvVars };
    delete customEnvVars[name];

    if (Object.keys(customEnvVars).length === 0) {
      delete userCustomizations.customEnvVars;
    } else {
      userCustomizations.customEnvVars = customEnvVars;
    }

    const updatedConfig: GlobalConfig = {
      ...globalConfig,
      userCustomizations,
    };

    await saveGlobalConfig(updatedConfig);

    return {
      success: true,
      message: `Environment variable "${name}" removed`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to remove environment variable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Show all current user customizations
 */
export async function showCustomizations(): Promise<CommandResult> {
  try {
    const globalConfig = await loadGlobalConfig();
    const userCustomizations = globalConfig.userCustomizations;

    if (!userCustomizations || Object.keys(userCustomizations).length === 0) {
      return {
        success: true,
        message: "No user customizations configured.\n\nUse 'sdc customize dotfiles <repo-url>' to add dotfiles\nUse 'sdc customize shell <path>' to add shell configuration\nUse 'sdc customize env <name> <value>' to add environment variables",
        data: { customizations: null },
      };
    }

    const lines: string[] = ["Current user customizations:"];

    // Dotfiles configuration
    if (userCustomizations.dotfilesRepo) {
      lines.push("\nDotfiles:");
      lines.push(`  Repository: ${userCustomizations.dotfilesRepo}`);
      if (userCustomizations.dotfilesTargetPath) {
        lines.push(`  Target path: ${userCustomizations.dotfilesTargetPath}`);
      }
      if (userCustomizations.dotfilesInstallCommand) {
        lines.push(`  Install command: ${userCustomizations.dotfilesInstallCommand}`);
      }
    } else if (userCustomizations.dotfiles) {
      // Show deprecated field if present
      lines.push("\nDotfiles (deprecated format):");
      lines.push(`  Repository: ${userCustomizations.dotfiles}`);
    }

    // Shell configuration
    if (userCustomizations.shellConfigSource) {
      lines.push("\nShell Configuration:");
      lines.push(`  Source: ${userCustomizations.shellConfigSource}`);
      lines.push(`  Target: ${userCustomizations.shellConfigTarget || "~/.zshrc"}`);
    } else if (userCustomizations.shellConfig) {
      // Show deprecated field if present
      lines.push("\nShell Configuration (deprecated format):");
      lines.push(`  Path: ${userCustomizations.shellConfig}`);
    }

    // Environment variables
    if (userCustomizations.customEnvVars && Object.keys(userCustomizations.customEnvVars).length > 0) {
      lines.push("\nEnvironment Variables:");
      for (const [name, value] of Object.entries(userCustomizations.customEnvVars)) {
        lines.push(`  ${name}="${value}"`);
      }
    }

    return {
      success: true,
      message: lines.join("\n"),
      data: { customizations: userCustomizations },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to show customizations: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Clear all user customizations
 */
export async function clearCustomizations(): Promise<CommandResult> {
  try {
    const globalConfig = await loadGlobalConfig();

    if (!globalConfig.userCustomizations || Object.keys(globalConfig.userCustomizations).length === 0) {
      return {
        success: false,
        message: "No customizations to clear",
      };
    }

    const updatedConfig: GlobalConfig = {
      ...globalConfig,
      userCustomizations: {},
    };

    await saveGlobalConfig(updatedConfig);

    return {
      success: true,
      message: "All user customizations cleared",
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to clear customizations: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
