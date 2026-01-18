import type { DiffChange, FileDiff } from "../types/index.js";

/**
 * Generate a simple line-by-line diff between two strings
 */
export function generateDiff(oldContent: string, newContent: string): DiffChange[] {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const changes: DiffChange[] = [];

  // Use a simple LCS-based diff algorithm
  const lcs = computeLCS(oldLines, newLines);

  let oldIndex = 0;
  let newIndex = 0;
  let lcsIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (
      lcsIndex < lcs.length &&
      oldIndex < oldLines.length &&
      newIndex < newLines.length &&
      oldLines[oldIndex] === lcs[lcsIndex] &&
      newLines[newIndex] === lcs[lcsIndex]
    ) {
      // Line is unchanged
      changes.push({ type: "unchanged", line: oldLines[oldIndex] });
      oldIndex++;
      newIndex++;
      lcsIndex++;
    } else if (
      oldIndex < oldLines.length &&
      (lcsIndex >= lcs.length || oldLines[oldIndex] !== lcs[lcsIndex])
    ) {
      // Line was removed
      changes.push({ type: "removed", line: oldLines[oldIndex] });
      oldIndex++;
    } else if (
      newIndex < newLines.length &&
      (lcsIndex >= lcs.length || newLines[newIndex] !== lcs[lcsIndex])
    ) {
      // Line was added
      changes.push({ type: "added", line: newLines[newIndex] });
      newIndex++;
    }
  }

  return changes;
}

/**
 * Compute the Longest Common Subsequence of two arrays of strings
 */
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // Create DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Fill the DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the LCS
  const lcs: string[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

/**
 * Create a FileDiff object for a file modification
 */
export function createFileDiff(
  path: string,
  oldContent: string | null,
  newContent: string
): FileDiff {
  if (oldContent === null) {
    // New file being created
    return {
      path,
      operation: "create",
      changes: newContent.split("\n").map((line) => ({
        type: "added" as const,
        line,
      })),
      newContent,
    };
  }

  // Compare old and new content
  if (oldContent === newContent) {
    return {
      path,
      operation: "modify",
      changes: [],
      oldContent,
      newContent,
    };
  }

  return {
    path,
    operation: "modify",
    changes: generateDiff(oldContent, newContent),
    oldContent,
    newContent,
  };
}

/**
 * Format a diff for console output with colors
 */
export function formatDiffForConsole(diff: FileDiff): string {
  const lines: string[] = [];

  // Header
  lines.push(`\n${"=".repeat(60)}`);
  lines.push(`File: ${diff.path}`);
  lines.push(`Operation: ${diff.operation.toUpperCase()}`);
  lines.push("=".repeat(60));

  if (diff.changes.length === 0) {
    lines.push("  (no changes)");
    return lines.join("\n");
  }

  // Show changes with context
  let lineNumber = 1;
  for (const change of diff.changes) {
    const prefix = change.type === "added" ? "+" : change.type === "removed" ? "-" : " ";
    const color = change.type === "added" ? "\x1b[32m" : change.type === "removed" ? "\x1b[31m" : "";
    const reset = change.type !== "unchanged" ? "\x1b[0m" : "";

    lines.push(`${color}${prefix} ${lineNumber.toString().padStart(3)}: ${change.line}${reset}`);

    if (change.type !== "removed") {
      lineNumber++;
    }
  }

  return lines.join("\n");
}

/**
 * Format a summary of changes for console output
 */
export function formatDiffSummary(diffs: FileDiff[]): string {
  const lines: string[] = [];

  for (const diff of diffs) {
    const added = diff.changes.filter((c) => c.type === "added").length;
    const removed = diff.changes.filter((c) => c.type === "removed").length;

    if (added === 0 && removed === 0) {
      lines.push(`  ${diff.path}: no changes`);
    } else {
      const addedStr = added > 0 ? `\x1b[32m+${added}\x1b[0m` : "";
      const removedStr = removed > 0 ? `\x1b[31m-${removed}\x1b[0m` : "";
      const separator = added > 0 && removed > 0 ? ", " : "";
      lines.push(`  ${diff.path}: ${addedStr}${separator}${removedStr}`);
    }
  }

  return lines.join("\n");
}

/**
 * Check if two configs have meaningful differences
 */
export function hasChanges(diff: FileDiff): boolean {
  return diff.changes.some((c) => c.type === "added" || c.type === "removed");
}
