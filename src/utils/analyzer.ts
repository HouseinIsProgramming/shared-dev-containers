/**
 * Project analyzer for auto-detecting project type and suggesting templates
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { exists } from "./config.js";
import type {
  ProjectConfig,
  ProjectFileDetection,
  ProjectType,
  FrameworkDetection,
  ProjectAnalysis,
} from "../types/index.js";

/**
 * Project file patterns to detect
 */
const PROJECT_FILES: Record<ProjectType, string[]> = {
  node: ["package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
  bun: ["bun.lockb", "bunfig.toml"],
  python: ["requirements.txt", "pyproject.toml", "setup.py", "Pipfile", "poetry.lock", "setup.cfg"],
  go: ["go.mod", "go.sum"],
  rust: ["Cargo.toml", "Cargo.lock"],
  java: ["pom.xml", "build.gradle", "build.gradle.kts", "gradlew"],
  dotnet: ["*.csproj", "*.fsproj", "*.sln", "global.json"],
  ruby: ["Gemfile", "Gemfile.lock", "*.gemspec"],
  php: ["composer.json", "composer.lock"],
  unknown: [],
};

/**
 * Framework detection patterns
 */
interface FrameworkPattern {
  /** Framework name */
  name: string;
  /** Project type this framework belongs to */
  projectType: ProjectType;
  /** Detection patterns */
  detect: {
    /** Package dependencies to look for */
    dependencies?: string[];
    /** Files to look for */
    files?: string[];
    /** Python packages in requirements.txt */
    pythonPackages?: string[];
    /** Go modules */
    goModules?: string[];
  };
  /** VS Code extensions */
  extensions: string[];
  /** Common ports */
  ports: number[];
  /** Additional commands */
  postCreateCommands: string[];
}

const FRAMEWORK_PATTERNS: FrameworkPattern[] = [
  // Node.js frameworks
  {
    name: "Next.js",
    projectType: "node",
    detect: { dependencies: ["next"] },
    extensions: ["bradlc.vscode-tailwindcss", "ms-vscode.vscode-typescript-next"],
    ports: [3000],
    postCreateCommands: [],
  },
  {
    name: "React",
    projectType: "node",
    detect: { dependencies: ["react", "react-dom"] },
    extensions: ["dsznajder.es7-react-js-snippets"],
    ports: [3000, 5173],
    postCreateCommands: [],
  },
  {
    name: "Vue.js",
    projectType: "node",
    detect: { dependencies: ["vue"] },
    extensions: ["Vue.volar", "Vue.vscode-typescript-vue-plugin"],
    ports: [5173, 8080],
    postCreateCommands: [],
  },
  {
    name: "Angular",
    projectType: "node",
    detect: { dependencies: ["@angular/core"], files: ["angular.json"] },
    extensions: ["Angular.ng-template"],
    ports: [4200],
    postCreateCommands: [],
  },
  {
    name: "Express",
    projectType: "node",
    detect: { dependencies: ["express"] },
    extensions: ["humao.rest-client"],
    ports: [3000, 8080],
    postCreateCommands: [],
  },
  {
    name: "NestJS",
    projectType: "node",
    detect: { dependencies: ["@nestjs/core"] },
    extensions: ["humao.rest-client"],
    ports: [3000],
    postCreateCommands: [],
  },
  {
    name: "Vite",
    projectType: "node",
    detect: { dependencies: ["vite"], files: ["vite.config.ts", "vite.config.js"] },
    extensions: [],
    ports: [5173],
    postCreateCommands: [],
  },
  {
    name: "Tailwind CSS",
    projectType: "node",
    detect: { dependencies: ["tailwindcss"], files: ["tailwind.config.js", "tailwind.config.ts"] },
    extensions: ["bradlc.vscode-tailwindcss"],
    ports: [],
    postCreateCommands: [],
  },
  {
    name: "TypeScript",
    projectType: "node",
    detect: { dependencies: ["typescript"], files: ["tsconfig.json"] },
    extensions: ["ms-vscode.vscode-typescript-next"],
    ports: [],
    postCreateCommands: [],
  },
  {
    name: "Jest",
    projectType: "node",
    detect: { dependencies: ["jest"], files: ["jest.config.js", "jest.config.ts"] },
    extensions: ["orta.vscode-jest"],
    ports: [],
    postCreateCommands: [],
  },
  {
    name: "Vitest",
    projectType: "node",
    detect: { dependencies: ["vitest"], files: ["vitest.config.ts"] },
    extensions: ["vitest.explorer"],
    ports: [],
    postCreateCommands: [],
  },
  {
    name: "Playwright",
    projectType: "node",
    detect: { dependencies: ["@playwright/test", "playwright"], files: ["playwright.config.ts"] },
    extensions: ["ms-playwright.playwright"],
    ports: [],
    postCreateCommands: ["npx playwright install --with-deps"],
  },
  // Python frameworks
  {
    name: "Django",
    projectType: "python",
    detect: { pythonPackages: ["django", "Django"], files: ["manage.py"] },
    extensions: ["batisteo.vscode-django"],
    ports: [8000],
    postCreateCommands: [],
  },
  {
    name: "Flask",
    projectType: "python",
    detect: { pythonPackages: ["flask", "Flask"] },
    extensions: [],
    ports: [5000],
    postCreateCommands: [],
  },
  {
    name: "FastAPI",
    projectType: "python",
    detect: { pythonPackages: ["fastapi", "FastAPI"] },
    extensions: [],
    ports: [8000],
    postCreateCommands: [],
  },
  {
    name: "pytest",
    projectType: "python",
    detect: { pythonPackages: ["pytest"], files: ["pytest.ini", "pyproject.toml"] },
    extensions: ["ms-python.python"],
    ports: [],
    postCreateCommands: [],
  },
  // Go frameworks
  {
    name: "Gin",
    projectType: "go",
    detect: { goModules: ["github.com/gin-gonic/gin"] },
    extensions: ["golang.go"],
    ports: [8080],
    postCreateCommands: [],
  },
  {
    name: "Echo",
    projectType: "go",
    detect: { goModules: ["github.com/labstack/echo"] },
    extensions: ["golang.go"],
    ports: [8080],
    postCreateCommands: [],
  },
  {
    name: "Fiber",
    projectType: "go",
    detect: { goModules: ["github.com/gofiber/fiber"] },
    extensions: ["golang.go"],
    ports: [3000],
    postCreateCommands: [],
  },
];

/**
 * Analyze a project directory and suggest the best template
 */
export async function analyzeProject(projectDir: string): Promise<ProjectAnalysis> {
  const detectedFiles: ProjectFileDetection[] = [];
  const reasoning: string[] = [];

  // Check for all known project files
  for (const [projectType, files] of Object.entries(PROJECT_FILES)) {
    for (const file of files) {
      // Handle glob patterns (e.g., *.csproj)
      if (file.includes("*")) {
        // For now, skip glob patterns - would need directory scanning
        continue;
      }

      const filePath = join(projectDir, file);
      const fileExists = await exists(filePath);

      if (fileExists) {
        let content: Record<string, unknown> | undefined;

        // Try to parse JSON files
        if (file.endsWith(".json")) {
          try {
            const rawContent = await readFile(filePath, "utf-8");
            content = JSON.parse(rawContent);
          } catch {
            // Ignore parse errors
          }
        }

        // Try to parse TOML-like files (basic parsing for pyproject.toml)
        if (file === "pyproject.toml") {
          try {
            const rawContent = await readFile(filePath, "utf-8");
            content = { raw: rawContent };
          } catch {
            // Ignore read errors
          }
        }

        // Try to read requirements.txt
        if (file === "requirements.txt") {
          try {
            const rawContent = await readFile(filePath, "utf-8");
            content = {
              packages: rawContent.split("\n")
                .map(line => line.trim())
                .filter(line => line && !line.startsWith("#"))
                .map(line => line.split(/[=<>!~\[]/)[0].trim())
            };
          } catch {
            // Ignore read errors
          }
        }

        // Try to read go.mod
        if (file === "go.mod") {
          try {
            const rawContent = await readFile(filePath, "utf-8");
            const requires = rawContent.match(/require\s*\(([^)]+)\)/s);
            const singleRequires = rawContent.match(/^require\s+(\S+)/gm);
            const modules: string[] = [];

            if (requires) {
              const lines = requires[1].split("\n");
              for (const line of lines) {
                const match = line.trim().match(/^(\S+)/);
                if (match) modules.push(match[1]);
              }
            }

            if (singleRequires) {
              for (const req of singleRequires) {
                const match = req.match(/^require\s+(\S+)/);
                if (match) modules.push(match[1]);
              }
            }

            content = { modules };
          } catch {
            // Ignore read errors
          }
        }

        detectedFiles.push({
          file,
          exists: true,
          content,
        });

        reasoning.push(`Found ${file} (indicates ${projectType} project)`);
      }
    }
  }

  // Determine primary project type
  const { projectType, confidence } = determineProjectType(detectedFiles);
  reasoning.push(`Primary project type detected: ${projectType} (confidence: ${Math.round(confidence * 100)}%)`);

  // Detect frameworks
  const frameworks = await detectFrameworks(projectDir, detectedFiles, projectType);
  for (const fw of frameworks) {
    reasoning.push(`Detected framework: ${fw.name} (confidence: ${Math.round(fw.confidence * 100)}%)`);
  }

  // Get recommended template
  const recommendedTemplate = getRecommendedTemplate(projectType, detectedFiles);
  reasoning.push(`Recommended template: ${recommendedTemplate}`);

  // Build suggested customizations
  const suggestedCustomizations = buildSuggestedCustomizations(frameworks, projectType);

  return {
    projectType,
    confidence,
    detectedFiles,
    frameworks,
    recommendedTemplate,
    suggestedCustomizations,
    reasoning,
  };
}

/**
 * Determine the primary project type from detected files
 */
function determineProjectType(detectedFiles: ProjectFileDetection[]): { projectType: ProjectType; confidence: number } {
  const scores: Record<ProjectType, number> = {
    node: 0,
    bun: 0,
    python: 0,
    go: 0,
    rust: 0,
    java: 0,
    dotnet: 0,
    ruby: 0,
    php: 0,
    unknown: 0,
  };

  // Score based on detected files
  for (const detection of detectedFiles) {
    if (!detection.exists) continue;

    // High priority files (primary indicators)
    if (detection.file === "package.json") {
      // Check for bun indicators in package.json
      const content = detection.content as { packageManager?: string } | undefined;
      if (content?.packageManager?.startsWith("bun")) {
        scores.bun += 3;
      } else {
        scores.node += 2;
      }
    }
    if (detection.file === "bun.lockb" || detection.file === "bunfig.toml") {
      scores.bun += 3;
    }
    if (detection.file === "requirements.txt" || detection.file === "pyproject.toml") {
      scores.python += 2;
    }
    if (detection.file === "go.mod") {
      scores.go += 3;
    }
    if (detection.file === "Cargo.toml") {
      scores.rust += 3;
    }
    if (detection.file === "pom.xml" || detection.file.includes("gradle")) {
      scores.java += 3;
    }
    if (detection.file === "Gemfile") {
      scores.ruby += 3;
    }
    if (detection.file === "composer.json") {
      scores.php += 3;
    }

    // Secondary indicators (lock files, etc.)
    if (detection.file === "package-lock.json" || detection.file === "yarn.lock" || detection.file === "pnpm-lock.yaml") {
      scores.node += 1;
    }
    if (detection.file === "Pipfile" || detection.file === "poetry.lock" || detection.file === "setup.py" || detection.file === "setup.cfg") {
      scores.python += 1;
    }
    if (detection.file === "go.sum") {
      scores.go += 1;
    }
    if (detection.file === "Cargo.lock") {
      scores.rust += 1;
    }
  }

  // Find highest scoring type
  let maxScore = 0;
  let projectType: ProjectType = "unknown";

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      projectType = type as ProjectType;
    }
  }

  // Calculate confidence (normalized)
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? maxScore / totalScore : 0;

  return { projectType, confidence };
}

/**
 * Detect frameworks used in the project
 */
async function detectFrameworks(
  _projectDir: string,
  detectedFiles: ProjectFileDetection[],
  projectType: ProjectType
): Promise<FrameworkDetection[]> {
  const frameworks: FrameworkDetection[] = [];

  // Get package.json dependencies
  const packageJson = detectedFiles.find(f => f.file === "package.json")?.content as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | undefined;

  const allDeps = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {}),
  };

  // Get Python packages
  const requirementsTxt = detectedFiles.find(f => f.file === "requirements.txt")?.content as {
    packages?: string[];
  } | undefined;
  const pythonPackages = requirementsTxt?.packages || [];

  // Get Go modules
  const goMod = detectedFiles.find(f => f.file === "go.mod")?.content as {
    modules?: string[];
  } | undefined;
  const goModules = goMod?.modules || [];

  // Check files that exist
  const existingFiles = detectedFiles.filter(f => f.exists).map(f => f.file);

  // Check each framework pattern
  for (const pattern of FRAMEWORK_PATTERNS) {
    if (pattern.projectType !== projectType) continue;

    let confidence = 0;
    let matches = 0;
    let totalChecks = 0;

    // Check dependencies
    if (pattern.detect.dependencies) {
      totalChecks += pattern.detect.dependencies.length;
      for (const dep of pattern.detect.dependencies) {
        if (allDeps[dep]) {
          matches++;
        }
      }
    }

    // Check files
    if (pattern.detect.files) {
      totalChecks += pattern.detect.files.length;
      for (const file of pattern.detect.files) {
        if (existingFiles.includes(file)) {
          matches++;
        }
      }
    }

    // Check Python packages
    if (pattern.detect.pythonPackages) {
      totalChecks += pattern.detect.pythonPackages.length;
      for (const pkg of pattern.detect.pythonPackages) {
        if (pythonPackages.some(p => p.toLowerCase() === pkg.toLowerCase())) {
          matches++;
        }
      }
    }

    // Check Go modules
    if (pattern.detect.goModules) {
      totalChecks += pattern.detect.goModules.length;
      for (const mod of pattern.detect.goModules) {
        if (goModules.some(m => m.includes(mod))) {
          matches++;
        }
      }
    }

    if (matches > 0 && totalChecks > 0) {
      confidence = matches / totalChecks;
      frameworks.push({
        name: pattern.name,
        confidence,
        extensions: pattern.extensions,
        ports: pattern.ports,
        postCreateCommands: pattern.postCreateCommands,
      });
    }
  }

  // Sort by confidence
  return frameworks.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get the recommended template for a project type
 */
function getRecommendedTemplate(projectType: ProjectType, detectedFiles: ProjectFileDetection[]): string {
  // Map project types to built-in templates
  const templateMap: Record<ProjectType, string> = {
    node: "node",
    bun: "bun",
    python: "python",
    go: "base", // No Go template yet, use base
    rust: "base", // No Rust template yet, use base
    java: "base", // No Java template yet, use base
    dotnet: "base", // No .NET template yet, use base
    ruby: "base", // No Ruby template yet, use base
    php: "base", // No PHP template yet, use base
    unknown: "base",
  };

  // Special case: check for bun indicators in Node projects
  if (projectType === "node") {
    const bunLock = detectedFiles.find(f => f.file === "bun.lockb" && f.exists);
    const packageJson = detectedFiles.find(f => f.file === "package.json")?.content as {
      packageManager?: string;
    } | undefined;

    if (bunLock || packageJson?.packageManager?.startsWith("bun")) {
      return "bun";
    }
  }

  return templateMap[projectType];
}

/**
 * Build suggested customizations based on detected frameworks
 */
function buildSuggestedCustomizations(
  frameworks: FrameworkDetection[],
  projectType: ProjectType
): Partial<ProjectConfig> {
  const extensions: string[] = [];
  const ports: number[] = [];
  const postCreateCommands: string[] = [];

  // Collect from frameworks
  for (const fw of frameworks) {
    extensions.push(...fw.extensions);
    ports.push(...fw.ports);
    postCreateCommands.push(...fw.postCreateCommands);
  }

  // Add default extensions based on project type
  if (projectType === "go") {
    extensions.push("golang.go");
  }
  if (projectType === "rust") {
    extensions.push("rust-lang.rust-analyzer");
  }
  if (projectType === "java") {
    extensions.push("vscjava.vscode-java-pack");
  }
  if (projectType === "dotnet") {
    extensions.push("ms-dotnettools.csharp");
  }
  if (projectType === "ruby") {
    extensions.push("shopify.ruby-lsp");
  }
  if (projectType === "php") {
    extensions.push("bmewburn.vscode-intelephense-client");
  }

  // Deduplicate
  const uniqueExtensions = [...new Set(extensions)];
  const uniquePorts = [...new Set(ports)];
  const uniqueCommands = [...new Set(postCreateCommands)];

  const customizations: Partial<ProjectConfig> = {};

  if (uniqueExtensions.length > 0) {
    customizations.extensions = uniqueExtensions;
  }

  if (uniquePorts.length > 0) {
    customizations.ports = uniquePorts;
  }

  if (uniqueCommands.length > 0) {
    customizations.postCreateCommands = uniqueCommands;
  }

  return customizations;
}

/**
 * Format analysis result as a human-readable string
 */
export function formatAnalysisResult(analysis: ProjectAnalysis): string {
  const lines: string[] = [];

  lines.push("Project Analysis Results");
  lines.push("========================");
  lines.push("");

  lines.push(`Project Type: ${analysis.projectType}`);
  lines.push(`Confidence: ${Math.round(analysis.confidence * 100)}%`);
  lines.push(`Recommended Template: ${analysis.recommendedTemplate}`);
  lines.push("");

  if (analysis.detectedFiles.length > 0) {
    lines.push("Detected Files:");
    for (const file of analysis.detectedFiles.filter(f => f.exists)) {
      lines.push(`  - ${file.file}`);
    }
    lines.push("");
  }

  if (analysis.frameworks.length > 0) {
    lines.push("Detected Frameworks:");
    for (const fw of analysis.frameworks) {
      lines.push(`  - ${fw.name} (${Math.round(fw.confidence * 100)}% confidence)`);
    }
    lines.push("");
  }

  if (analysis.suggestedCustomizations.extensions?.length) {
    lines.push("Suggested Extensions:");
    for (const ext of analysis.suggestedCustomizations.extensions) {
      lines.push(`  - ${ext}`);
    }
    lines.push("");
  }

  if (analysis.suggestedCustomizations.ports?.length) {
    lines.push(`Suggested Ports: ${analysis.suggestedCustomizations.ports.join(", ")}`);
    lines.push("");
  }

  if (analysis.suggestedCustomizations.postCreateCommands?.length) {
    lines.push("Additional Setup Commands:");
    for (const cmd of analysis.suggestedCustomizations.postCreateCommands) {
      lines.push(`  - ${cmd}`);
    }
    lines.push("");
  }

  lines.push("Reasoning:");
  for (const reason of analysis.reasoning) {
    lines.push(`  - ${reason}`);
  }

  return lines.join("\n");
}
