import { ChangeSource } from './git';

const TARGETS: Record<ChangeSource, string> = {
	staged: 'staged changes',
	unstaged: 'uncommitted, not yet staged changes',
	untracked: 'new, not yet tracked files',
};

export interface PromptContext {
	branch: string;
	recentSubjects: string;
	diffstat: string;
	diff: string;
	source: ChangeSource;
}

export function buildPrompt(context: PromptContext): string {
	return `Write a git commit message for the ${TARGETS[context.source]} below.

Rules:
- Conventional Commits: type(scope): Subject
- Subject in English, capitalized, imperative mood, no trailing period, max 72 chars
- Add a body only when the change is not self-evident: blank line, then terse bullets
- No Co-Authored-By trailer, no attribution, no mention of AI
- Output the commit message only, no preamble, no code fences

Branch: ${context.branch}

Recent commit subjects for style reference:
${context.recentSubjects}

Diffstat:
${context.diffstat}

Diff:
${context.diff}`;
}

export function truncateDiff(diff: string, limit: number): string {
	if (diff.length <= limit) {
		return diff;
	}

	return `${diff.slice(0, limit)}\n\n[diff truncated at ${limit} characters]`;
}
