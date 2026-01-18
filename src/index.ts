/**
 * shared-dev-containers
 *
 * A tool for developers to have preconfigured devcontainers per project
 * with the ability to customize while maintaining compatibility with a shared base.
 */

// Export types
export type {
  DevcontainerConfig,
  DevcontainerBuildConfig,
  ProjectConfig,
  GlobalConfig,
  CommandResult,
} from "./types/index.js";

// Export commands
export { initGlobal, initProject, updateProject } from "./commands/init.js";
export { listTemplates, getTemplate, createTemplate, deleteTemplate } from "./commands/template.js";
export { syncProjects, checkSync } from "./commands/sync.js";
export { scaffoldProject, listScaffoldTemplates } from "./commands/scaffold.js";
export type { ScaffoldOptions, ScaffoldResultData } from "./commands/scaffold.js";

// Export utilities
export {
  loadGlobalConfig,
  saveGlobalConfig,
  loadProjectConfig,
  saveProjectConfig,
  loadDevcontainerConfig,
  saveDevcontainerConfig,
  getConfigDir,
  getConfigPath,
  exists,
  DEFAULT_GLOBAL_CONFIG,
} from "./utils/config.js";

export { deepMerge, mergeConfigs, createBaseConfig } from "./utils/merge.js";

// Export built-in templates
export { BUILTIN_TEMPLATE_NAMES, getBuiltinTemplate, listBuiltinTemplates, loadBuiltinTemplates } from "./templates/index.js";
