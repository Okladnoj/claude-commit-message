import { spawn } from 'child_process';
import * as vscode from 'vscode';

export interface GitInputBox {
	value: string;
	placeholder?: string;
}

export interface GitRepository {
	rootUri: vscode.Uri;
	inputBox: GitInputBox;
	state: { HEAD?: { name?: string } };
	diff(cached: boolean): Promise<string>;
}

export interface GitApi {
	git: { path: string };
	repositories: GitRepository[];
}

export type ChangeSource = 'staged' | 'unstaged' | 'untracked';

export interface RepositoryChanges {
	diff: string;
	source: ChangeSource;
}

interface GitExtensionExports {
	getAPI(version: 1): GitApi;
}

export async function getGitApi(): Promise<GitApi | undefined> {
	const extension = vscode.extensions.getExtension<GitExtensionExports>('vscode.git');
	if (!extension) {
		return undefined;
	}

	if (!extension.isActive) {
		await extension.activate();
	}

	return extension.exports.getAPI(1);
}

export function resolveRepository(
	api: GitApi,
	sourceControl?: vscode.SourceControl,
): GitRepository | undefined {
	const rootPath = sourceControl?.rootUri?.fsPath;
	if (!rootPath) {
		return repositoryOfActiveEditor(api) ?? api.repositories[0];
	}

	return api.repositories.find((repository) => repository.rootUri.fsPath === rootPath);
}

function repositoryOfActiveEditor(api: GitApi): GitRepository | undefined {
	const filePath = vscode.window.activeTextEditor?.document.uri.fsPath;
	if (!filePath) {
		return undefined;
	}

	return api.repositories
		.filter((repository) => filePath.startsWith(`${repository.rootUri.fsPath}/`))
		.sort((a, b) => b.rootUri.fsPath.length - a.rootUri.fsPath.length)[0];
}

export async function collectChanges(
	api: GitApi,
	repository: GitRepository,
	limit: number,
): Promise<RepositoryChanges | undefined> {
	const staged = await repository.diff(true);
	if (staged.trim().length > 0) {
		return { diff: staged, source: 'staged' };
	}

	const unstaged = await repository.diff(false);
	if (unstaged.trim().length > 0) {
		return { diff: unstaged, source: 'unstaged' };
	}

	const untracked = await collectUntrackedDiff(api.git.path, repository.rootUri.fsPath, limit);
	if (untracked.length > 0) {
		return { diff: untracked, source: 'untracked' };
	}

	return undefined;
}

async function collectUntrackedDiff(gitPath: string, root: string, limit: number): Promise<string> {
	const listing = await runGit(gitPath, root, ['ls-files', '--others', '--exclude-standard']);
	if (!listing) {
		return '';
	}

	const parts: string[] = [];
	let size = 0;

	for (const file of listing.split('\n').filter(Boolean)) {
		if (size >= limit) {
			break;
		}

		const diff = await runGit(gitPath, root, ['diff', '--no-index', '--', '/dev/null', file], [0, 1]);
		if (!diff) {
			continue;
		}

		parts.push(diff);
		size += diff.length;
	}

	return parts.join('\n');
}

export function runGit(
	gitPath: string,
	cwd: string,
	args: string[],
	allowedCodes: number[] = [0],
): Promise<string> {
	return new Promise((resolve) => {
		const child = spawn(gitPath, args, { cwd });
		let stdout = '';

		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString();
		});

		child.on('error', () => resolve(''));
		child.on('close', (code) => resolve(allowedCodes.includes(code ?? 1) ? stdout.trim() : ''));
	});
}
