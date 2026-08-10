import { spawn } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { log } from './output';
import { Settings } from './settings';

export const CLAUDE_NOT_FOUND = 127;
export const GENERATION_TIMED_OUT = -1;
export const GENERATION_CANCELLED = -2;
export const LIMIT_REACHED = -3;

const EXIT_GRACE_MS = 300;

export class GeneratorError extends Error {
	readonly code: number;
	readonly resetsAt?: Date;

	constructor(message: string, code: number, resetsAt?: Date) {
		super(message);
		this.code = code;
		this.resetsAt = resetsAt;
	}
}

export function generatorScriptPath(extensionPath: string): string {
	return path.join(extensionPath, 'scripts', 'gen-commit-msg.sh');
}

export function runGenerator(
	extensionPath: string,
	prompt: string,
	settings: Settings,
	cwd: string,
	token?: vscode.CancellationToken,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn('sh', [generatorScriptPath(extensionPath)], {
			cwd,
			env: {
				...process.env,
				CLAUDE_BIN: settings.claudePath,
				CLAUDE_MODEL: settings.model,
				CLAUDE_TIMEOUT: String(settings.timeoutSec),
			},
		});

		let stdout = '';
		let stderr = '';
		let settled = false;
		let timedOut = false;
		let cancelled = false;
		let graceTimer: NodeJS.Timeout | undefined;

		const timeoutTimer = setTimeout(() => {
			timedOut = true;
			child.kill('SIGKILL');
		}, (settings.timeoutSec + 5) * 1000);

		const cancellation = token?.onCancellationRequested(() => {
			cancelled = true;
			child.kill('SIGKILL');
		});

		const finalize = (code: number | null): void => {
			if (settled) {
				return;
			}

			settled = true;
			clearTimeout(timeoutTimer);
			clearTimeout(graceTimer);
			cancellation?.dispose();

			if (stderr.trim().length > 0) {
				log(`generator stderr: ${stderr.trim()}`);
			}

			const failure = describeFailure(code, { timedOut, cancelled }, settings, `${stderr}\n${stdout}`);
			if (failure) {
				reject(failure);
				return;
			}

			resolve(cleanMessage(stdout));
		};

		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString();
		});

		child.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		child.on('error', (error) => {
			clearTimeout(timeoutTimer);
			clearTimeout(graceTimer);
			cancellation?.dispose();
			settled = true;
			reject(new GeneratorError(error.message, 1));
		});

		child.on('exit', (code) => {
			graceTimer = setTimeout(() => finalize(code), EXIT_GRACE_MS);
		});

		child.on('close', (code) => finalize(code));

		child.stdin.end(prompt);
	});
}

function describeFailure(
	code: number | null,
	state: { timedOut: boolean; cancelled: boolean },
	settings: Settings,
	output: string,
): GeneratorError | undefined {
	if (state.cancelled) {
		return new GeneratorError('Generation cancelled', GENERATION_CANCELLED);
	}

	if (state.timedOut) {
		return new GeneratorError(`Generation timed out after ${settings.timeoutSec}s`, GENERATION_TIMED_OUT);
	}

	if (code === CLAUDE_NOT_FOUND) {
		return new GeneratorError(`Claude CLI not found: ${settings.claudePath}`, CLAUDE_NOT_FOUND);
	}

	if (code === 0) {
		return undefined;
	}

	const limit = describeLimit(output);
	if (limit) {
		return limit;
	}

	return new GeneratorError(firstMeaningfulLine(output) ?? `Generator exited with code ${code}`, code ?? 1);
}

function describeLimit(output: string): GeneratorError | undefined {
	const match = /(usage limit reached|rate limit(?: reached| exceeded)?)[^\n]*/i.exec(output);
	if (!match) {
		return undefined;
	}

	return new GeneratorError(match[0].trim(), LIMIT_REACHED, resetTime(match[0]));
}

function resetTime(text: string): Date | undefined {
	const seconds = /\|\s*(\d{10,13})/.exec(text);
	if (!seconds) {
		return undefined;
	}

	const value = Number(seconds[1]);

	return new Date(seconds[1].length > 10 ? value : value * 1000);
}

function firstMeaningfulLine(output: string): string | undefined {
	return output
		.split('\n')
		.map((line) => line.trim())
		.find((line) => line.length > 0);
}

export function cleanMessage(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed.startsWith('```')) {
		return trimmed;
	}

	return trimmed
		.replace(/^```[^\n]*\n/, '')
		.replace(/\n?```$/, '')
		.trim();
}
