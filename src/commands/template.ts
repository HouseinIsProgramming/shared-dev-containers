import { readdir, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { loadGlobalConfig, exists } from "../utils/config.js";
import type { DevcontainerConfig, CommandResult } from "../types/index.js";

/**
 * List available templates
 */
export async function listTemplates(): Promise<CommandResult> {
  try {
    const globalConfig = await loadGlobalConfig();
    const templatesDir = globalConfig.templatesDir;

    if (!(await exists(templatesDir))) {
      return {
        success: true,
        message: "No templates found. Run 'sdc init --global' to create default templates.",
        data: { templates: [] },
      };
    }

    const entries = await readdir(templatesDir, { withFileTypes: true });
    const templates: string[] = [];

    // Check for base template (devcontainer.json in root)
    if (await exists(join(templatesDir, "devcontainer.json"))) {
      templates.push("base");
    }

    // Check for named templates (subdirectories with devcontainer.json)
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const templatePath = join(templatesDir, entry.name, "devcontainer.json");
        if (await exists(templatePath)) {
          templates.push(entry.name);
        }
      }
    }

    return {
      success: true,
      message: `Found ${templates.length} template(s)`,
      data: { templates },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list templates: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Get a specific template
 */
export async function getTemplate(name: string): Promise<CommandResult> {
  try {
    const globalConfig = await loadGlobalConfig();
    const templatesDir = globalConfig.templatesDir;

    let templatePath: string;
    if (name === "base") {
      templatePath = join(templatesDir, "devcontainer.json");
    } else {
      templatePath = join(templatesDir, name, "devcontainer.json");
    }

    if (!(await exists(templatePath))) {
      return {
        success: false,
        message: `Template "${name}" not found`,
      };
    }

    const content = await readFile(templatePath, "utf-8");
    const config = JSON.parse(content) as DevcontainerConfig;

    return {
      success: true,
      message: `Template "${name}" loaded`,
      data: { name, config },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get template: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Create a new template
 */
export async function createTemplate(
  name: string,
  config: DevcontainerConfig
): Promise<CommandResult> {
  try {
    const globalConfig = await loadGlobalConfig();
    const templatesDir = globalConfig.templatesDir;

    let templateDir: string;
    let templatePath: string;

    if (name === "base") {
      templateDir = templatesDir;
      templatePath = join(templatesDir, "devcontainer.json");
    } else {
      templateDir = join(templatesDir, name);
      templatePath = join(templateDir, "devcontainer.json");
    }

    // Create template directory
    await mkdir(templateDir, { recursive: true });

    // Write template config
    await writeFile(templatePath, JSON.stringify(config, null, 2), "utf-8");

    return {
      success: true,
      message: `Template "${name}" created at ${templatePath}`,
      data: { name, path: templatePath },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create template: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Delete a template
 */
export async function deleteTemplate(name: string): Promise<CommandResult> {
  if (name === "base") {
    return {
      success: false,
      message: "Cannot delete the base template",
    };
  }

  try {
    const globalConfig = await loadGlobalConfig();
    const templateDir = join(globalConfig.templatesDir, name);

    if (!(await exists(templateDir))) {
      return {
        success: false,
        message: `Template "${name}" not found`,
      };
    }

    await rm(templateDir, { recursive: true });

    return {
      success: true,
      message: `Template "${name}" deleted`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to delete template: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
