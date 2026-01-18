import { exec } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { exists } from "./config.js";
import type { GitTemplateSource, GitOperationResult, GitAuthType } from "../types/index.js";

const execAsync = promisify(exec);

/**
 * Get the cache directory for remote template repositories
 */
export function getRemoteCacheDir(): string {
  return join(homedir(), ".shared-dev-containers", "remote-cache");
}

/**
 * Get the local cache path for a remote repository
 */
export function getRepoCachePath(repoName: string): string {
  // Sanitize repo name for filesystem
  const safeName = repoName.replace(/[^a-zA-Z0-9-_]/g, "_");
  return join(getRemoteCacheDir(), safeName);
}

/**
 * Parse a Git URL to extract useful information
 */
export function parseGitUrl(url: string): { host: string; path: string; isSSH: boolean } {
  // SSH format: git@github.com:owner/repo.git
  const sshMatch = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return { host: sshMatch[1], path: sshMatch[2], isSSH: true };
  }

  // HTTPS format: https://github.com/owner/repo.git
  const httpsMatch = url.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    return { host: httpsMatch[1], path: httpsMatch[2], isSSH: false };
  }

  throw new Error(`Invalid Git URL format: ${url}`);
}

/**
 * Build the Git URL with credentials if needed
 */
export function buildAuthenticatedUrl(
  source: GitTemplateSource
): string {
  const { url, authType, credentials } = source;

  if (!authType || authType === "none" || authType === "ssh") {
    return url;
  }

  // For token auth with HTTPS, embed the token in the URL
  if (authType === "token" && credentials) {
    const parsed = parseGitUrl(url);
    if (!parsed.isSSH) {
      // Format: https://<token>@github.com/owner/repo.git
      return `https://${credentials}@${parsed.host}/${parsed.path}.git`;
    }
  }

  return url;
}

/**
 * Build Git command with proper SSH key if specified
 */
function buildGitCommand(
  command: string,
  source: GitTemplateSource
): string {
  const { authType, credentials } = source;

  // For SSH with custom key
  if (authType === "ssh" && credentials) {
    const sshCommand = `ssh -i "${credentials}" -o StrictHostKeyChecking=accept-new`;
    return `GIT_SSH_COMMAND='${sshCommand}' git ${command}`;
  }

  return `git ${command}`;
}

/**
 * Clone a remote Git repository
 */
export async function cloneRepository(
  source: GitTemplateSource,
  targetDir: string
): Promise<GitOperationResult> {
  try {
    // Ensure parent directory exists
    await mkdir(targetDir, { recursive: true });

    // Remove existing directory if it exists
    if (await exists(targetDir)) {
      await rm(targetDir, { recursive: true, force: true });
    }

    const authenticatedUrl = buildAuthenticatedUrl(source);
    const branch = source.branch || "main";

    const cloneCmd = buildGitCommand(
      `clone --branch ${branch} --single-branch --depth 1 "${authenticatedUrl}" "${targetDir}"`,
      source
    );

    await execAsync(cloneCmd, { timeout: 120000 }); // 2 minute timeout

    // Get the current commit hash
    const { stdout: commitHash } = await execAsync("git rev-parse HEAD", { cwd: targetDir });

    return {
      success: true,
      message: `Cloned repository ${source.name} from ${source.url}`,
      hasChanges: true,
      commitHash: commitHash.trim(),
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Pull latest changes from a remote repository
 */
export async function pullRepository(
  source: GitTemplateSource,
  repoDir: string
): Promise<GitOperationResult> {
  try {
    // Get current commit hash before pull
    const { stdout: oldCommit } = await execAsync("git rev-parse HEAD", { cwd: repoDir });

    // Fetch and pull
    const fetchCmd = buildGitCommand("fetch origin", source);
    await execAsync(fetchCmd, { cwd: repoDir, timeout: 60000 });

    const branch = source.branch || "main";
    const resetCmd = `git reset --hard origin/${branch}`;
    await execAsync(resetCmd, { cwd: repoDir, timeout: 30000 });

    // Get new commit hash
    const { stdout: newCommit } = await execAsync("git rev-parse HEAD", { cwd: repoDir });

    const hasChanges = oldCommit.trim() !== newCommit.trim();

    return {
      success: true,
      message: hasChanges
        ? `Updated repository ${source.name} with new changes`
        : `Repository ${source.name} is already up to date`,
      hasChanges,
      commitHash: newCommit.trim(),
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to pull repository: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Sync a remote repository (clone if not exists, pull if exists)
 */
export async function syncRepository(
  source: GitTemplateSource
): Promise<GitOperationResult> {
  const cachePath = getRepoCachePath(source.name);

  if (await exists(join(cachePath, ".git"))) {
    return pullRepository(source, cachePath);
  } else {
    return cloneRepository(source, cachePath);
  }
}

/**
 * Check if a repository needs syncing based on sync interval
 */
export function needsSync(source: GitTemplateSource): boolean {
  if (!source.lastSynced) {
    return true;
  }

  const syncInterval = source.syncInterval ?? 24; // Default 24 hours
  if (syncInterval === 0) {
    return false; // Manual sync only
  }

  const lastSyncTime = new Date(source.lastSynced).getTime();
  const now = Date.now();
  const hoursSinceSync = (now - lastSyncTime) / (1000 * 60 * 60);

  return hoursSinceSync >= syncInterval;
}

/**
 * Get the path to templates within a cached repository
 */
export function getRepoTemplatesPath(source: GitTemplateSource): string {
  const cachePath = getRepoCachePath(source.name);
  if (source.templatesPath) {
    return join(cachePath, source.templatesPath);
  }
  return cachePath;
}

/**
 * Verify that a Git repository URL is accessible
 */
export async function verifyRepositoryAccess(
  source: GitTemplateSource
): Promise<GitOperationResult> {
  try {
    const authenticatedUrl = buildAuthenticatedUrl(source);
    const lsRemoteCmd = buildGitCommand(`ls-remote "${authenticatedUrl}" HEAD`, source);

    await execAsync(lsRemoteCmd, { timeout: 30000 });

    return {
      success: true,
      message: `Repository ${source.url} is accessible`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Provide helpful error messages
    if (message.includes("Permission denied") || message.includes("Authentication failed")) {
      return {
        success: false,
        message: `Authentication failed for ${source.url}. Check your credentials or SSH key.`,
      };
    }

    if (message.includes("not found") || message.includes("Repository not found")) {
      return {
        success: false,
        message: `Repository ${source.url} not found. Check the URL and your access permissions.`,
      };
    }

    return {
      success: false,
      message: `Failed to access repository: ${message}`,
    };
  }
}

/**
 * List templates available in a remote repository
 */
export async function listRemoteTemplates(
  source: GitTemplateSource
): Promise<string[]> {
  const templatesPath = getRepoTemplatesPath(source);

  if (!(await exists(templatesPath))) {
    return [];
  }

  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(templatesPath, { withFileTypes: true });
  const templates: string[] = [];

  // Check for base template (devcontainer.json in root)
  if (await exists(join(templatesPath, "devcontainer.json"))) {
    templates.push("base");
  }

  // Check for named templates (subdirectories with devcontainer.json)
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const templatePath = join(templatesPath, entry.name, "devcontainer.json");
      if (await exists(templatePath)) {
        templates.push(entry.name);
      }
    }
  }

  return templates;
}

/**
 * Get a template configuration from a remote repository
 */
export async function getRemoteTemplate(
  source: GitTemplateSource,
  templateName: string
): Promise<{ success: boolean; config?: Record<string, unknown>; message: string }> {
  const templatesPath = getRepoTemplatesPath(source);

  let templatePath: string;
  if (templateName === "base") {
    templatePath = join(templatesPath, "devcontainer.json");
  } else {
    templatePath = join(templatesPath, templateName, "devcontainer.json");
  }

  if (!(await exists(templatePath))) {
    return {
      success: false,
      message: `Template "${templateName}" not found in repository "${source.name}"`,
    };
  }

  try {
    const content = await readFile(templatePath, "utf-8");
    // Remove comments from JSON (devcontainer.json supports JSONC)
    const jsonContent = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const config = JSON.parse(jsonContent);

    return {
      success: true,
      config,
      message: `Loaded template "${templateName}" from repository "${source.name}"`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to load template: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Determine the appropriate auth type from URL
 */
export function detectAuthType(url: string): GitAuthType {
  if (url.startsWith("git@") || url.includes("ssh://")) {
    return "ssh";
  }
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return "https";
  }
  return "none";
}
