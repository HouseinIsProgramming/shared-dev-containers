/**
 * Conflict detection and resolution for shared-dev-containers
 *
 * This module scans for conflicts between base template requirements
 * and project customizations, providing automatic resolution suggestions.
 */

import type {
  DevcontainerConfig,
  ProjectConfig,
  Conflict,
  ConflictResolution,
  ConflictDetectionResult,
  ConflictCategory,
} from "../types/index.js";

/**
 * Known feature version patterns and their compatibility rules
 */
const FEATURE_VERSION_PATTERNS: Record<string, {
  versionKey: string;
  extractVersion: (config: Record<string, unknown>) => string | undefined;
}> = {
  "ghcr.io/devcontainers/features/node": {
    versionKey: "version",
    extractVersion: (config) => config.version as string | undefined,
  },
  "ghcr.io/devcontainers/features/python": {
    versionKey: "version",
    extractVersion: (config) => config.version as string | undefined,
  },
  "ghcr.io/devcontainers/features/go": {
    versionKey: "version",
    extractVersion: (config) => config.version as string | undefined,
  },
  "ghcr.io/devcontainers/features/rust": {
    versionKey: "version",
    extractVersion: (config) => config.version as string | undefined,
  },
  "ghcr.io/devcontainers/features/java": {
    versionKey: "version",
    extractVersion: (config) => config.version as string | undefined,
  },
};

/**
 * Known conflicting extension pairs
 */
const CONFLICTING_EXTENSIONS: Array<{
  extensions: [string, string];
  reason: string;
}> = [
  {
    extensions: ["esbenp.prettier-vscode", "ms-python.black-formatter"],
    reason: "Both are formatters that may conflict when formatting Python files",
  },
  {
    extensions: ["dbaeumer.vscode-eslint", "charliermarsh.ruff"],
    reason: "Both provide linting for JavaScript/TypeScript, may have overlapping rules",
  },
];

/**
 * Environment variables that commonly conflict
 */
const SENSITIVE_ENV_VARS = [
  "NODE_ENV",
  "DEBUG",
  "LOG_LEVEL",
  "PORT",
  "DATABASE_URL",
  "API_URL",
  "API_KEY",
];

/**
 * Generate a unique conflict ID
 */
function generateConflictId(category: ConflictCategory, field: string): string {
  return `${category}:${field}`.replace(/[^a-zA-Z0-9:_-]/g, "_");
}

/**
 * Extract feature name without version from feature URL
 */
function extractFeatureName(featureUrl: string): string {
  // Remove version suffix (e.g., ":1", ":2")
  return featureUrl.replace(/:\d+$/, "");
}

/**
 * Detect version conflicts in features
 */
function detectVersionConflicts(
  baseConfig: DevcontainerConfig,
  projectConfig: ProjectConfig
): Conflict[] {
  const conflicts: Conflict[] = [];

  if (!baseConfig.features || !projectConfig.features) {
    return conflicts;
  }

  // Check each project feature against base features
  for (const [projectFeatureKey, projectFeatureConfig] of Object.entries(projectConfig.features)) {
    const projectFeatureName = extractFeatureName(projectFeatureKey);

    // Find matching feature in base config
    for (const [baseFeatureKey, baseFeatureConfig] of Object.entries(baseConfig.features)) {
      const baseFeatureName = extractFeatureName(baseFeatureKey);

      if (projectFeatureName === baseFeatureName) {
        // Check version pattern for this feature
        const pattern = FEATURE_VERSION_PATTERNS[projectFeatureName];

        if (pattern) {
          const baseVersion = pattern.extractVersion(baseFeatureConfig as Record<string, unknown>);
          const projectVersion = pattern.extractVersion(projectFeatureConfig as Record<string, unknown>);

          if (baseVersion && projectVersion && baseVersion !== projectVersion) {
            conflicts.push({
              id: generateConflictId("version", projectFeatureName),
              category: "version",
              severity: "error",
              message: `Version conflict for ${projectFeatureName}: base uses version ${baseVersion}, but project specifies ${projectVersion}`,
              baseValue: baseVersion,
              projectValue: projectVersion,
              field: `features.${projectFeatureKey}.version`,
            });
          }
        }

        // Check for feature key version mismatch (e.g., :1 vs :2)
        const baseKeyVersion = baseFeatureKey.match(/:(\d+)$/)?.[1];
        const projectKeyVersion = projectFeatureKey.match(/:(\d+)$/)?.[1];

        if (baseKeyVersion && projectKeyVersion && baseKeyVersion !== projectKeyVersion) {
          conflicts.push({
            id: generateConflictId("feature", `${projectFeatureName}_api_version`),
            category: "feature",
            severity: "warning",
            message: `Feature API version mismatch for ${projectFeatureName}: base uses v${baseKeyVersion}, project uses v${projectKeyVersion}`,
            baseValue: baseKeyVersion,
            projectValue: projectKeyVersion,
            field: `features.${projectFeatureKey}`,
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Detect environment variable conflicts
 */
function detectEnvConflicts(
  baseConfig: DevcontainerConfig,
  projectConfig: ProjectConfig
): Conflict[] {
  const conflicts: Conflict[] = [];

  const baseEnv = baseConfig.containerEnv || {};
  const projectEnv = projectConfig.env || {};

  for (const [key, projectValue] of Object.entries(projectEnv)) {
    if (key in baseEnv) {
      const baseValue = baseEnv[key];

      if (baseValue !== projectValue) {
        const isSensitive = SENSITIVE_ENV_VARS.includes(key);

        conflicts.push({
          id: generateConflictId("environment", key),
          category: "environment",
          severity: isSensitive ? "warning" : "info",
          message: `Environment variable '${key}' conflict: base sets '${baseValue}', project overrides with '${projectValue}'`,
          baseValue,
          projectValue,
          field: `env.${key}`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Detect port conflicts
 */
function detectPortConflicts(
  baseConfig: DevcontainerConfig,
  projectConfig: ProjectConfig
): Conflict[] {
  const conflicts: Conflict[] = [];

  const basePorts = new Set(baseConfig.forwardPorts || []);
  const projectPorts = projectConfig.ports || [];

  // Check for duplicate ports that might indicate confusion
  for (const port of projectPorts) {
    if (basePorts.has(port)) {
      conflicts.push({
        id: generateConflictId("port", String(port)),
        category: "port",
        severity: "info",
        message: `Port ${port} is already forwarded in base template. Project duplicate will be ignored.`,
        baseValue: port,
        projectValue: port,
        field: `ports.${port}`,
      });
    }
  }

  return conflicts;
}

/**
 * Detect VS Code extension conflicts
 */
function detectExtensionConflicts(
  baseConfig: DevcontainerConfig,
  projectConfig: ProjectConfig
): Conflict[] {
  const conflicts: Conflict[] = [];

  const baseExtensions = new Set(
    baseConfig.customizations?.vscode?.extensions || []
  );
  const projectExtensions = new Set(projectConfig.extensions || []);
  const allExtensions = new Set([...baseExtensions, ...projectExtensions]);

  // Check for known conflicting extension pairs
  for (const { extensions, reason } of CONFLICTING_EXTENSIONS) {
    const [ext1, ext2] = extensions;

    if (allExtensions.has(ext1) && allExtensions.has(ext2)) {
      // Determine source of each extension
      const ext1Source = baseExtensions.has(ext1) ? "base" : "project";
      const ext2Source = baseExtensions.has(ext2) ? "base" : "project";

      if (ext1Source !== ext2Source) {
        conflicts.push({
          id: generateConflictId("extension", `${ext1}_${ext2}`),
          category: "extension",
          severity: "warning",
          message: `Potential extension conflict: ${ext1} (${ext1Source}) and ${ext2} (${ext2Source}) - ${reason}`,
          baseValue: ext1Source === "base" ? ext1 : ext2,
          projectValue: ext1Source === "project" ? ext1 : ext2,
          field: `extensions.${ext1}`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Detect image compatibility issues
 */
function detectImageConflicts(
  baseConfig: DevcontainerConfig,
  projectConfig: ProjectConfig
): Conflict[] {
  const conflicts: Conflict[] = [];

  const baseImage = baseConfig.image || "";
  const projectFeatures = projectConfig.features || {};

  // Check for Node.js version in image vs feature
  if (baseImage.includes("node:")) {
    const imageNodeVersion = baseImage.match(/node:(\d+)/)?.[1];

    for (const [featureKey, featureConfig] of Object.entries(projectFeatures)) {
      if (featureKey.includes("features/node")) {
        const featureVersion = (featureConfig as Record<string, unknown>).version as string | undefined;

        if (imageNodeVersion && featureVersion && imageNodeVersion !== featureVersion) {
          conflicts.push({
            id: generateConflictId("image", "node_version"),
            category: "image",
            severity: "error",
            message: `Node.js version mismatch: base image uses Node ${imageNodeVersion}, but project feature specifies Node ${featureVersion}`,
            baseValue: imageNodeVersion,
            projectValue: featureVersion,
            field: "image",
          });
        }
      }
    }
  }

  // Check for Python version in image vs feature
  if (baseImage.includes("python:")) {
    const imagePythonVersion = baseImage.match(/python:(\d+\.?\d*)/)?.[1];

    for (const [featureKey, featureConfig] of Object.entries(projectFeatures)) {
      if (featureKey.includes("features/python")) {
        const featureVersion = (featureConfig as Record<string, unknown>).version as string | undefined;

        if (imagePythonVersion && featureVersion && !featureVersion.startsWith(imagePythonVersion)) {
          conflicts.push({
            id: generateConflictId("image", "python_version"),
            category: "image",
            severity: "error",
            message: `Python version mismatch: base image uses Python ${imagePythonVersion}, but project feature specifies Python ${featureVersion}`,
            baseValue: imagePythonVersion,
            projectValue: featureVersion,
            field: "image",
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Detect feature incompatibilities
 */
function detectFeatureIncompatibilities(
  baseConfig: DevcontainerConfig,
  projectConfig: ProjectConfig
): Conflict[] {
  const conflicts: Conflict[] = [];

  const baseFeatures = Object.keys(baseConfig.features || {}).map(extractFeatureName);
  const projectFeatures = Object.keys(projectConfig.features || {}).map(extractFeatureName);
  const allFeatures = new Set([...baseFeatures, ...projectFeatures]);

  // Check for Docker-in-Docker with certain features that might have issues
  if (allFeatures.has("ghcr.io/devcontainers/features/docker-in-docker")) {
    // Docker-in-Docker with Podman could cause issues
    if (allFeatures.has("ghcr.io/devcontainers/features/podman")) {
      conflicts.push({
        id: generateConflictId("feature", "docker_podman"),
        category: "feature",
        severity: "warning",
        message: "Docker-in-Docker and Podman features are both present. These container runtimes may conflict.",
        baseValue: "docker-in-docker",
        projectValue: "podman",
        field: "features",
      });
    }
  }

  // Check for multiple shell configurations
  const shellFeatures = [...allFeatures].filter(f =>
    f.includes("zsh") || f.includes("fish") || f.includes("powershell")
  );

  if (shellFeatures.length > 1) {
    conflicts.push({
      id: generateConflictId("feature", "multiple_shells"),
      category: "feature",
      severity: "info",
      message: `Multiple shell configuration features detected: ${shellFeatures.join(", ")}. This may cause configuration conflicts.`,
      field: "features.shell",
    });
  }

  return conflicts;
}

/**
 * Generate resolution suggestions for detected conflicts
 */
function generateResolutions(conflicts: Conflict[]): ConflictResolution[] {
  const resolutions: ConflictResolution[] = [];

  for (const conflict of conflicts) {
    switch (conflict.category) {
      case "version":
        resolutions.push({
          conflictId: conflict.id,
          action: "use_base",
          description: `Use base template version (${conflict.baseValue}) for consistency across projects`,
          suggestedValue: conflict.baseValue,
          autoApplicable: true,
        });
        resolutions.push({
          conflictId: conflict.id,
          action: "use_project",
          description: `Keep project version (${conflict.projectValue}) if this project has specific requirements`,
          suggestedValue: conflict.projectValue,
          autoApplicable: true,
        });
        break;

      case "environment":
        resolutions.push({
          conflictId: conflict.id,
          action: "use_project",
          description: `Use project value '${conflict.projectValue}' (overrides base)`,
          suggestedValue: conflict.projectValue,
          autoApplicable: true,
        });
        resolutions.push({
          conflictId: conflict.id,
          action: "use_base",
          description: `Remove project override and use base value '${conflict.baseValue}'`,
          suggestedValue: conflict.baseValue,
          autoApplicable: true,
        });
        break;

      case "port":
        resolutions.push({
          conflictId: conflict.id,
          action: "use_base",
          description: `Remove duplicate port ${conflict.projectValue} from project config`,
          autoApplicable: true,
        });
        break;

      case "extension":
        resolutions.push({
          conflictId: conflict.id,
          action: "custom",
          description: "Keep both extensions but configure them to avoid conflicts (e.g., disable formatting for specific file types)",
          autoApplicable: false,
        });
        resolutions.push({
          conflictId: conflict.id,
          action: "use_base",
          description: `Remove project extension and use only base extension`,
          autoApplicable: true,
        });
        break;

      case "image":
        resolutions.push({
          conflictId: conflict.id,
          action: "use_base",
          description: `Remove the conflicting feature from project config and rely on the base image's version`,
          autoApplicable: true,
        });
        resolutions.push({
          conflictId: conflict.id,
          action: "custom",
          description: `Update base template image to match project requirements (requires base template modification)`,
          autoApplicable: false,
        });
        break;

      case "feature":
        resolutions.push({
          conflictId: conflict.id,
          action: "custom",
          description: "Review feature combination and remove one if not needed, or ensure proper configuration",
          autoApplicable: false,
        });
        break;

      default:
        resolutions.push({
          conflictId: conflict.id,
          action: "custom",
          description: "Manual review required to resolve this conflict",
          autoApplicable: false,
        });
    }
  }

  return resolutions;
}

/**
 * Main function to detect all conflicts between base and project configurations
 */
export function detectConflicts(
  baseConfig: DevcontainerConfig,
  projectConfig: ProjectConfig
): ConflictDetectionResult {
  const conflicts: Conflict[] = [
    ...detectVersionConflicts(baseConfig, projectConfig),
    ...detectEnvConflicts(baseConfig, projectConfig),
    ...detectPortConflicts(baseConfig, projectConfig),
    ...detectExtensionConflicts(baseConfig, projectConfig),
    ...detectImageConflicts(baseConfig, projectConfig),
    ...detectFeatureIncompatibilities(baseConfig, projectConfig),
  ];

  const resolutions = generateResolutions(conflicts);

  const summary = {
    errors: conflicts.filter(c => c.severity === "error").length,
    warnings: conflicts.filter(c => c.severity === "warning").length,
    info: conflicts.filter(c => c.severity === "info").length,
  };

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    resolutions,
    summary,
  };
}

/**
 * Format conflict detection result for CLI output
 */
export function formatConflictReport(result: ConflictDetectionResult): string {
  if (!result.hasConflicts) {
    return "✓ No conflicts detected between base template and project customizations.";
  }

  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("  CONFLICT DETECTION REPORT");
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`Summary: ${result.summary.errors} error(s), ${result.summary.warnings} warning(s), ${result.summary.info} info`);
  lines.push("");

  // Group conflicts by severity
  const errorConflicts = result.conflicts.filter(c => c.severity === "error");
  const warningConflicts = result.conflicts.filter(c => c.severity === "warning");
  const infoConflicts = result.conflicts.filter(c => c.severity === "info");

  if (errorConflicts.length > 0) {
    lines.push("❌ ERRORS (must be resolved):");
    lines.push("─────────────────────────────────────────────────────────────────");
    for (const conflict of errorConflicts) {
      lines.push(`  • ${conflict.message}`);
      lines.push(`    Field: ${conflict.field}`);
      const relevantResolutions = result.resolutions.filter(r => r.conflictId === conflict.id);
      if (relevantResolutions.length > 0) {
        lines.push("    Suggested resolutions:");
        for (const res of relevantResolutions) {
          const autoTag = res.autoApplicable ? " [auto-fixable]" : "";
          lines.push(`      → ${res.description}${autoTag}`);
        }
      }
      lines.push("");
    }
  }

  if (warningConflicts.length > 0) {
    lines.push("⚠️  WARNINGS (recommended to review):");
    lines.push("─────────────────────────────────────────────────────────────────");
    for (const conflict of warningConflicts) {
      lines.push(`  • ${conflict.message}`);
      lines.push(`    Field: ${conflict.field}`);
      const relevantResolutions = result.resolutions.filter(r => r.conflictId === conflict.id);
      if (relevantResolutions.length > 0) {
        lines.push("    Suggested resolutions:");
        for (const res of relevantResolutions) {
          const autoTag = res.autoApplicable ? " [auto-fixable]" : "";
          lines.push(`      → ${res.description}${autoTag}`);
        }
      }
      lines.push("");
    }
  }

  if (infoConflicts.length > 0) {
    lines.push("ℹ️  INFO (for your awareness):");
    lines.push("─────────────────────────────────────────────────────────────────");
    for (const conflict of infoConflicts) {
      lines.push(`  • ${conflict.message}`);
      lines.push(`    Field: ${conflict.field}`);
      lines.push("");
    }
  }

  lines.push("═══════════════════════════════════════════════════════════════");

  return lines.join("\n");
}

/**
 * Check if conflicts contain any errors (blocking issues)
 */
export function hasBlockingConflicts(result: ConflictDetectionResult): boolean {
  return result.summary.errors > 0;
}
