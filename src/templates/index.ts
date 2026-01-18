/**
 * Built-in templates for shared-dev-containers
 */

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DevcontainerConfig } from "../types/index.js";

// Resolve the templates directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Built-in template names
 */
export const BUILTIN_TEMPLATE_NAMES = ["base", "node", "bun", "python", "claude-zsh"] as const;

/**
 * Get a built-in template by name
 */
export async function getBuiltinTemplate(name: string): Promise<DevcontainerConfig | undefined> {
  if (!BUILTIN_TEMPLATE_NAMES.includes(name as typeof BUILTIN_TEMPLATE_NAMES[number])) {
    return undefined;
  }

  try {
    const templatePath = join(__dirname, `${name}.json`);
    const content = await readFile(templatePath, "utf-8");
    return JSON.parse(content) as DevcontainerConfig;
  } catch {
    return undefined;
  }
}

/**
 * List all built-in template names
 */
export function listBuiltinTemplates(): string[] {
  return [...BUILTIN_TEMPLATE_NAMES];
}

/**
 * Load all built-in templates
 */
export async function loadBuiltinTemplates(): Promise<Record<string, DevcontainerConfig>> {
  const templates: Record<string, DevcontainerConfig> = {};

  for (const name of BUILTIN_TEMPLATE_NAMES) {
    const template = await getBuiltinTemplate(name);
    if (template) {
      templates[name] = template;
    }
  }

  return templates;
}
