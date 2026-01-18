/**
 * Interactive prompt utilities for CLI wizard
 *
 * Uses Node.js readline for cross-platform interactive prompts
 */

import * as readline from "node:readline";

/**
 * Create a readline interface for interactive prompts
 */
function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt for text input
 */
export async function promptText(
  question: string,
  defaultValue?: string
): Promise<string> {
  const rl = createInterface();

  const displayQuestion = defaultValue
    ? `${question} (${defaultValue}): `
    : `${question}: `;

  return new Promise((resolve) => {
    rl.question(displayQuestion, (answer) => {
      rl.close();
      const trimmedAnswer = answer.trim();
      resolve(trimmedAnswer || defaultValue || "");
    });
  });
}

/**
 * Prompt for a number input
 */
export async function promptNumber(
  question: string,
  defaultValue?: number
): Promise<number | undefined> {
  const rl = createInterface();

  const displayQuestion = defaultValue !== undefined
    ? `${question} (${defaultValue}): `
    : `${question}: `;

  return new Promise((resolve) => {
    rl.question(displayQuestion, (answer) => {
      rl.close();
      const trimmedAnswer = answer.trim();
      if (!trimmedAnswer) {
        resolve(defaultValue);
        return;
      }
      const num = parseInt(trimmedAnswer, 10);
      resolve(isNaN(num) ? defaultValue : num);
    });
  });
}

/**
 * Prompt for comma-separated numbers (ports)
 */
export async function promptPorts(
  question: string,
  defaultPorts?: number[]
): Promise<number[]> {
  const rl = createInterface();

  const defaultStr = defaultPorts?.length ? defaultPorts.join(", ") : "";
  const displayQuestion = defaultStr
    ? `${question} (${defaultStr}): `
    : `${question}: `;

  return new Promise((resolve) => {
    rl.question(displayQuestion, (answer) => {
      rl.close();
      const trimmedAnswer = answer.trim();
      if (!trimmedAnswer) {
        resolve(defaultPorts || []);
        return;
      }
      const ports = trimmedAnswer
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0 && n < 65536);
      resolve(ports);
    });
  });
}

/**
 * Prompt for comma-separated strings
 */
export async function promptList(
  question: string,
  defaultItems?: string[]
): Promise<string[]> {
  const rl = createInterface();

  const defaultStr = defaultItems?.length ? defaultItems.join(", ") : "";
  const displayQuestion = defaultStr
    ? `${question} (${defaultStr}): `
    : `${question}: `;

  return new Promise((resolve) => {
    rl.question(displayQuestion, (answer) => {
      rl.close();
      const trimmedAnswer = answer.trim();
      if (!trimmedAnswer) {
        resolve(defaultItems || []);
        return;
      }
      const items = trimmedAnswer
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      resolve(items);
    });
  });
}

/**
 * Prompt for yes/no confirmation
 */
export async function promptConfirm(
  question: string,
  defaultValue: boolean = true
): Promise<boolean> {
  const rl = createInterface();

  const hint = defaultValue ? "[Y/n]" : "[y/N]";
  const displayQuestion = `${question} ${hint}: `;

  return new Promise((resolve) => {
    rl.question(displayQuestion, (answer) => {
      rl.close();
      const trimmedAnswer = answer.trim().toLowerCase();
      if (!trimmedAnswer) {
        resolve(defaultValue);
        return;
      }
      resolve(trimmedAnswer === "y" || trimmedAnswer === "yes");
    });
  });
}

/**
 * Option for select prompts
 */
export interface SelectOption<T = string> {
  label: string;
  value: T;
  description?: string;
}

/**
 * Prompt to select from a list of options
 */
export async function promptSelect<T = string>(
  question: string,
  options: SelectOption<T>[],
  defaultIndex: number = 0
): Promise<T> {
  const rl = createInterface();

  console.log(`\n${question}`);
  options.forEach((opt, i) => {
    const marker = i === defaultIndex ? ">" : " ";
    const desc = opt.description ? ` - ${opt.description}` : "";
    console.log(`  ${marker} ${i + 1}. ${opt.label}${desc}`);
  });

  const displayQuestion = `Select option (1-${options.length}) [${defaultIndex + 1}]: `;

  return new Promise((resolve) => {
    rl.question(displayQuestion, (answer) => {
      rl.close();
      const trimmedAnswer = answer.trim();
      if (!trimmedAnswer) {
        resolve(options[defaultIndex].value);
        return;
      }
      const num = parseInt(trimmedAnswer, 10);
      if (isNaN(num) || num < 1 || num > options.length) {
        resolve(options[defaultIndex].value);
        return;
      }
      resolve(options[num - 1].value);
    });
  });
}

/**
 * Prompt to select multiple options from a list
 */
export async function promptMultiSelect<T = string>(
  question: string,
  options: SelectOption<T>[],
  defaultSelected: number[] = []
): Promise<T[]> {
  const rl = createInterface();

  console.log(`\n${question}`);
  options.forEach((opt, i) => {
    const marker = defaultSelected.includes(i) ? "[x]" : "[ ]";
    const desc = opt.description ? ` - ${opt.description}` : "";
    console.log(`  ${marker} ${i + 1}. ${opt.label}${desc}`);
  });

  const displayQuestion = `Select options (comma-separated, e.g., 1,3,5) or 'all'/'none': `;

  return new Promise((resolve) => {
    rl.question(displayQuestion, (answer) => {
      rl.close();
      const trimmedAnswer = answer.trim().toLowerCase();

      if (!trimmedAnswer) {
        resolve(defaultSelected.map((i) => options[i].value));
        return;
      }

      if (trimmedAnswer === "all") {
        resolve(options.map((opt) => opt.value));
        return;
      }

      if (trimmedAnswer === "none") {
        resolve([]);
        return;
      }

      const indices = trimmedAnswer
        .split(",")
        .map((s) => parseInt(s.trim(), 10) - 1)
        .filter((n) => !isNaN(n) && n >= 0 && n < options.length);

      resolve(indices.map((i) => options[i].value));
    });
  });
}

/**
 * Display a section header
 */
export function printSection(title: string): void {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(50)}`);
}

/**
 * Display a success message
 */
export function printSuccess(message: string): void {
  console.log(`✓ ${message}`);
}

/**
 * Display an info message
 */
export function printInfo(message: string): void {
  console.log(`ℹ ${message}`);
}

/**
 * Display a warning message
 */
export function printWarning(message: string): void {
  console.log(`⚠ ${message}`);
}

/**
 * Clear the console
 */
export function clearScreen(): void {
  console.clear();
}

/**
 * Print a welcome banner
 */
export function printWelcome(): void {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     shared-dev-containers - Configuration Wizard         ║
╠══════════════════════════════════════════════════════════╣
║  This wizard will guide you through setting up your      ║
║  devcontainer configuration step by step.                ║
║                                                          ║
║  Press Enter to accept default values shown in (parens)  ║
╚══════════════════════════════════════════════════════════╝
`);
}
