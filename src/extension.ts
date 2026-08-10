import { spawn } from 'child_process';
import * as vscode from 'vscode';
import { ButtonSetup } from './buttonSetup';
import {
	CLAUDE_NOT_FOUND,
	GENERATION_CANCELLED,
	GENERATION_TIMED_OUT,
	GeneratorError,
	runGenerator,
} from './generator';
import {
	ChangeSource,
	GitApi,
	GitInputBox,
	GitRepository,
	RepositoryChanges,
	collectChanges,
	getGitApi,
	resolveRepository,
	runGit,
} from './git';
import { installGitHook } from './hook';
import { createOutput, log, showOutput } from './output';
import { buildPrompt, truncateDiff } from './prompt';
import { Settings, readSettings } from './settings';

let activeGeneration: vscode.CancellationTokenSource | undefined;

export function activate(context: vscode.ExtensionContext): void {
	const setup = new ButtonSetup(context);

	context.subscriptions.push(
		createOutput(),
		setup,
		vscode.commands.registerCommand('claudeCommit.generate', (sourceControl?: vscode.SourceControl) => {
			if (sourceControl) {
				setup.confirmWorking();
			}

			return generateCommitMessage(context.extensionPath, sourceControl);
		}),
		vscode.commands.registerCommand('claudeCommit.cancel', () => activeGeneration?.cancel()),
		vscode.commands.registerCommand('claudeCommit.enableButton', () => setup.runExplicit()),
		vscode.commands.registerCommand('claudeCommit.installGitHook', () => runInstallGitHook(context.extensionPath)),
	);

	void setBusy(false);
	void verifyClaudeAvailable();
	void setup.start();
}

export function deactivate(): void {
	return;
}

async function generateCommitMessage(extensionPath: string, sourceControl?: vscode.SourceControl): Promise<void> {
	if (activeGeneration) {
		vscode.window.showWarningMessage('Claude Commit Message: a generation is already running');
		return;
	}

	const api = await getGitApi();
	if (!api) {
		reportFailure('Git extension is not available');
		return;
	}

	const repository = resolveRepository(api, sourceControl);
	if (!repository) {
		reportFailure('No git repository matches this Source Control view');
		return;
	}

	const settings = readSettings();
	const changes = await collectChanges(api, repository, settings.diffLimit);
	if (!changes) {
		vscode.window.showWarningMessage('Claude Commit Message: no changes to describe');
		return;
	}

	const inputBox = sourceControl?.inputBox ?? repository.inputBox;
	const prompt = await buildRepositoryPrompt(api, repository, changes, settings);
	const message = await generateWithProgress(extensionPath, prompt, settings, repository.rootUri.fsPath, inputBox);
	if (!message) {
		return;
	}

	inputBox.value = message;
	warnAboutSource(changes.source);
}

function warnAboutSource(source: ChangeSource): void {
	if (source === 'staged') {
		return;
	}

	const described = source === 'unstaged' ? 'unstaged changes' : 'new untracked files';

	vscode.window.showWarningMessage(
		`Claude Commit Message: nothing is staged, the message describes ${described}`,
	);
}

async function buildRepositoryPrompt(
	api: GitApi,
	repository: GitRepository,
	changes: RepositoryChanges,
	settings: Settings,
): Promise<string> {
	const root = repository.rootUri.fsPath;

	const [recentSubjects, diffstat] = await Promise.all([
		runGit(api.git.path, root, ['log', `-${settings.recentCommits}`, '--pretty=format:%s']),
		runGit(api.git.path, root, diffstatArgs(changes.source)),
	]);

	return buildPrompt({
		branch: repository.state.HEAD?.name ?? '',
		recentSubjects,
		diffstat,
		diff: truncateDiff(changes.diff, settings.diffLimit),
		source: changes.source,
	});
}

function diffstatArgs(source: ChangeSource): string[] {
	if (source === 'staged') {
		return ['diff', '--cached', '--stat'];
	}

	if (source === 'unstaged') {
		return ['diff', '--stat'];
	}

	return ['status', '--short'];
}

async function generateWithProgress(
	extensionPath: string,
	prompt: string,
	settings: Settings,
	cwd: string,
	inputBox: GitInputBox,
): Promise<string | undefined> {
	log(`generating a message for ${cwd}, prompt size ${prompt.length}`);
	const startedAt = Date.now();
	const source = new vscode.CancellationTokenSource();
	const placeholder = inputBox.placeholder;

	activeGeneration = source;
	inputBox.placeholder = 'Claude is writing a commit message…';
	await setBusy(true);

	try {
		return await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.SourceControl,
				title: 'Claude is writing a commit message…',
			},
			async () => {
				try {
					const message = await runGenerator(extensionPath, prompt, settings, cwd, source.token);
					log(`generated in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
					return message;
				} catch (error) {
					reportGeneratorError(error, settings);
					return undefined;
				}
			},
		);
	} finally {
		activeGeneration = undefined;
		source.dispose();
		inputBox.placeholder = placeholder;
		await setBusy(false);
	}
}

function setBusy(busy: boolean): Thenable<unknown> {
	return vscode.commands.executeCommand('setContext', 'claudeCommit.busy', busy);
}


async function runInstallGitHook(extensionPath: string): Promise<void> {
	const api = await getGitApi();
	if (!api) {
		reportFailure('Git extension is not available');
		return;
	}

	await installGitHook(extensionPath, api);
}

function reportGeneratorError(error: unknown, settings: Settings): void {
	const generatorError = error instanceof GeneratorError ? error : undefined;
	log(`generation failed: ${error instanceof Error ? error.message : String(error)}`);

	if (generatorError?.code === GENERATION_CANCELLED) {
		return;
	}

	if (generatorError?.code === CLAUDE_NOT_FOUND) {
		reportFailure(
			`Claude CLI not found (${settings.claudePath}). Set claudeCommit.claudePath to its absolute path.`,
		);
		return;
	}

	if (generatorError?.code === GENERATION_TIMED_OUT) {
		reportFailure(`Generation timed out after ${settings.timeoutSec}s, see the output for details`);
		return;
	}

	reportFailure('Generation failed, see the output for details');
}

function reportFailure(message: string): void {
	log(message);
	vscode.window.showErrorMessage(`Claude Commit Message: ${message}`, 'Show Output').then((action) => {
		if (action !== 'Show Output') {
			return;
		}

		showOutput();
	});
}

function verifyClaudeAvailable(): Promise<void> {
	const { claudePath } = readSettings();

	return new Promise((resolve) => {
		const child = spawn(claudePath, ['--version']);

		child.on('error', () => {
			log(`claude is not reachable as "${claudePath}"; set claudeCommit.claudePath if generation fails`);
			resolve();
		});

		child.on('close', (code) => {
			log(code === 0 ? `claude is available as "${claudePath}"` : `claude --version exited with code ${code}`);
			resolve();
		});
	});
}
