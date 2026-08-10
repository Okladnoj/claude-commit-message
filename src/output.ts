import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function createOutput(): vscode.OutputChannel {
	channel = vscode.window.createOutputChannel('Claude Commit Message');
	return channel;
}

export function log(message: string): void {
	if (!channel) {
		return;
	}

	channel.appendLine(`[${new Date().toISOString()}] ${message}`);
}

export function showOutput(): void {
	channel?.show(true);
}
