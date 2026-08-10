import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { GitApi, GitRepository, runGit } from './git';
import { log } from './output';

const HOOK_FILES = ['prepare-commit-msg', 'gen-commit-msg.sh'];

export async function installGitHook(extensionPath: string, api: GitApi): Promise<void> {
	const repository = await pickRepository(api);
	if (!repository) {
		return;
	}

	const hooksDir = await resolveHooksDir(api.git.path, repository);
	if (!hooksDir) {
		vscode.window.showErrorMessage('Claude Commit Message: could not resolve the hooks directory');
		return;
	}

	const hookPath = path.join(hooksDir, 'prepare-commit-msg');
	if (fs.existsSync(hookPath) && !(await confirmOverwrite(hookPath))) {
		return;
	}

	fs.mkdirSync(hooksDir, { recursive: true });
	copyHookFiles(extensionPath, hooksDir);

	log(`hook installed into ${hooksDir}`);
	vscode.window.showInformationMessage(
		`Claude Commit Message: hook installed into ${hooksDir}. It is local to this clone and is not versioned.`,
	);
}

async function pickRepository(api: GitApi): Promise<GitRepository | undefined> {
	if (api.repositories.length === 0) {
		vscode.window.showErrorMessage('Claude Commit Message: no git repository is open');
		return undefined;
	}

	if (api.repositories.length === 1) {
		return api.repositories[0];
	}

	const items = api.repositories.map((repository) => ({
		label: path.basename(repository.rootUri.fsPath),
		description: repository.rootUri.fsPath,
		repository,
	}));

	const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Install the hook into…' });

	return picked?.repository;
}

async function resolveHooksDir(gitPath: string, repository: GitRepository): Promise<string | undefined> {
	const root = repository.rootUri.fsPath;
	const relative = await runGit(gitPath, root, ['rev-parse', '--git-path', 'hooks']);
	if (!relative) {
		return undefined;
	}

	return path.isAbsolute(relative) ? relative : path.join(root, relative);
}

async function confirmOverwrite(hookPath: string): Promise<boolean> {
	const answer = await vscode.window.showWarningMessage(
		`${hookPath} already exists. Overwrite it?`,
		{ modal: true },
		'Overwrite',
	);

	return answer === 'Overwrite';
}

function copyHookFiles(extensionPath: string, hooksDir: string): void {
	for (const file of HOOK_FILES) {
		const target = path.join(hooksDir, file);
		fs.copyFileSync(path.join(extensionPath, 'scripts', file), target);
		fs.chmodSync(target, 0o755);
	}
}
