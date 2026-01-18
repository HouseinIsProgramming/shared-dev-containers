/**
 * Core types for shared-dev-containers
 */

/**
 * Base devcontainer configuration
 */
export interface DevcontainerConfig {
  name: string;
  image?: string;
  build?: DevcontainerBuildConfig;
  features?: Record<string, Record<string, unknown>>;
  customizations?: {
    vscode?: {
      extensions?: string[];
      settings?: Record<string, unknown>;
    };
  };
  forwardPorts?: number[];
  postCreateCommand?: string | string[];
  postStartCommand?: string | string[];
  remoteUser?: string;
  containerEnv?: Record<string, string>;
  mounts?: string[];
  runArgs?: string[];
}

/**
 * Build configuration for devcontainer
 */
export interface DevcontainerBuildConfig {
  dockerfile?: string;
  context?: string;
  args?: Record<string, string>;
  target?: string;
  cacheFrom?: string | string[];
}

/**
 * Project configuration that extends base devcontainer
 */
export interface ProjectConfig {
  /** Project name/identifier */
  name: string;
  /** Base template to extend from */
  extends?: string;
  /** Additional features to add */
  features?: Record<string, Record<string, unknown>>;
  /** Additional VS Code extensions */
  extensions?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Additional ports to forward */
  ports?: number[];
  /** Post-create commands specific to project */
  postCreateCommands?: string[];
  /** Custom overrides to devcontainer.json */
  overrides?: Partial<DevcontainerConfig>;
}

/**
 * Global configuration for shared-dev-containers
 */
export interface GlobalConfig {
  /** Base templates directory */
  templatesDir: string;
  /** Default base image */
  defaultImage: string;
  /** Default features to include */
  defaultFeatures: Record<string, Record<string, unknown>>;
  /** User customizations */
  userCustomizations?: {
    dotfiles?: string;
    shellConfig?: string;
  };
  /** Remote template repositories configuration */
  remoteTemplates?: RemoteTemplatesConfig;
}

/**
 * CLI command result
 */
export interface CommandResult<T = Record<string, unknown>> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * Options for dry-run mode
 */
export interface DryRunOptions {
  dryRun?: boolean;
}

/**
 * Represents a single change in a diff
 */
export interface DiffChange {
  type: "added" | "removed" | "unchanged";
  line: string;
}

/**
 * Represents the diff between old and new file content
 */
export interface FileDiff {
  path: string;
  operation: "create" | "modify" | "delete";
  changes: DiffChange[];
  oldContent?: string;
  newContent?: string;
}

/**
 * Result of a dry-run operation for a single project
 */
export interface DryRunResult {
  project: string;
  path: string;
  wouldChange: boolean;
  diffs: FileDiff[];
  conflicts?: string[];
}

/**
 * Authentication type for Git repositories
 */
export type GitAuthType = "ssh" | "https" | "token" | "none";

/**
 * Configuration for a remote Git template repository
 */
export interface GitTemplateSource {
  /** Unique identifier for this remote template source */
  name: string;
  /** Git repository URL (HTTPS or SSH) */
  url: string;
  /** Branch to use (defaults to main) */
  branch?: string;
  /** Authentication type */
  authType?: GitAuthType;
  /** Path to SSH key or token file (for token auth) */
  credentials?: string;
  /** How often to auto-sync in hours (0 = manual only) */
  syncInterval?: number;
  /** Last sync timestamp (ISO string) */
  lastSynced?: string;
  /** Subdirectory within repo containing templates */
  templatesPath?: string;
}

/**
 * Result of a Git operation
 */
export interface GitOperationResult {
  success: boolean;
  message: string;
  /** Whether changes were fetched */
  hasChanges?: boolean;
  /** Commit hash after operation */
  commitHash?: string;
}

/**
 * Extended global configuration with remote template support
 */
export interface RemoteTemplatesConfig {
  /** List of remote Git template repositories */
  repositories: GitTemplateSource[];
  /** Cache directory for cloned repositories */
  cacheDir: string;
  /** Whether to auto-sync on commands like 'update' and 'sync' */
  autoSync: boolean;
  /** Default sync interval in hours */
  defaultSyncInterval: number;
}

/**
 * Severity level of a conflict
 */
export type ConflictSeverity = "error" | "warning" | "info";

/**
 * Category of conflict detected
 */
export type ConflictCategory =
  | "version"
  | "environment"
  | "feature"
  | "port"
  | "extension"
  | "command"
  | "image";

/**
 * Represents a single detected conflict
 */
export interface Conflict {
  /** Unique identifier for this conflict type */
  id: string;
  /** Category of the conflict */
  category: ConflictCategory;
  /** Severity of the conflict */
  severity: ConflictSeverity;
  /** Human-readable description of the conflict */
  message: string;
  /** Value from the base template */
  baseValue?: unknown;
  /** Value from the project configuration */
  projectValue?: unknown;
  /** Field path where conflict occurs (e.g., "features.node.version") */
  field: string;
}

/**
 * Suggested resolution for a conflict
 */
export interface ConflictResolution {
  /** The conflict this resolution addresses */
  conflictId: string;
  /** Type of resolution action */
  action: "use_base" | "use_project" | "merge" | "custom";
  /** Human-readable description of the resolution */
  description: string;
  /** Suggested value to use */
  suggestedValue?: unknown;
  /** Whether this can be auto-applied */
  autoApplicable: boolean;
}

/**
 * Result of conflict detection
 */
export interface ConflictDetectionResult {
  /** Whether there are any conflicts */
  hasConflicts: boolean;
  /** List of detected conflicts */
  conflicts: Conflict[];
  /** Suggested resolutions for each conflict */
  resolutions: ConflictResolution[];
  /** Summary counts by severity */
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

/**
 * Project file detection result
 */
export interface ProjectFileDetection {
  /** File that was detected */
  file: string;
  /** Whether the file exists */
  exists: boolean;
  /** Parsed content (if applicable) */
  content?: Record<string, unknown>;
}

/**
 * Detected project type
 */
export type ProjectType =
  | "node"
  | "bun"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "dotnet"
  | "ruby"
  | "php"
  | "unknown";

/**
 * Framework detection result
 */
export interface FrameworkDetection {
  /** Framework name */
  name: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Suggested VS Code extensions */
  extensions: string[];
  /** Suggested ports */
  ports: number[];
  /** Additional post-create commands */
  postCreateCommands: string[];
}

/**
 * Complete project analysis result
 */
export interface ProjectAnalysis {
  /** Detected primary project type */
  projectType: ProjectType;
  /** Confidence level for primary detection (0-1) */
  confidence: number;
  /** All detected project files */
  detectedFiles: ProjectFileDetection[];
  /** Detected frameworks */
  frameworks: FrameworkDetection[];
  /** Recommended template name */
  recommendedTemplate: string;
  /** Suggested customizations */
  suggestedCustomizations: Partial<ProjectConfig>;
  /** Human-readable reasoning */
  reasoning: string[];
}
