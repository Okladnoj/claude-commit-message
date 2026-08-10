import * as vscode from 'vscode';

export interface Settings {
	claudePath: string;
	model: string;
	diffLimit: number;
	timeoutSec: number;
	recentCommits: number;
}

export function readSettings(): Settings {
	const config = vscode.workspace.getConfiguration('claudeCommit');

	return {
		claudePath: config.get<string>('claudePath', 'claude'),
		model: config.get<string>('model', 'sonnet'),
		diffLimit: config.get<number>('diffLimit', 60000),
		timeoutSec: config.get<number>('timeoutSec', 90),
		recentCommits: config.get<number>('recentCommits', 8),
	};
}
