import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

export const EXTENSION_ID = 'OKJI.claude-cli-commit-message';

const PROPOSED_API_KEY = 'enable-proposed-api';

const EDITOR_DIRECTORIES: ReadonlyArray<[string, string]> = [
	['cursor', '.cursor'],
	['windsurf', '.windsurf'],
	['antigravity', '.antigravity'],
	['insiders', '.vscode-insiders'],
	['codium', '.vscodium'],
];

export function argvPath(): string {
	const appName = vscode.env.appName.toLowerCase();
	const match = EDITOR_DIRECTORIES.find(([marker]) => appName.includes(marker));

	return path.join(os.homedir(), match ? match[1] : '.vscode', 'argv.json');
}

export function isButtonEnabled(): boolean {
	const file = argvPath();
	if (!fs.existsSync(file)) {
		return false;
	}

	return listsExtension(fs.readFileSync(file, 'utf8'));
}

export function enableButton(): void {
	const file = argvPath();
	if (!fs.existsSync(file)) {
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, `{\n\t"${PROPOSED_API_KEY}": ["${EXTENSION_ID}"]\n}\n`);
		return;
	}

	const original = fs.readFileSync(file, 'utf8');
	if (listsExtension(original)) {
		return;
	}

	const updated = withExtensionListed(original);
	assertParsable(updated);

	fs.copyFileSync(file, `${file}.bak`);
	fs.writeFileSync(file, updated);
}

function listsExtension(text: string): boolean {
	const values = proposedApiValues(text);

	return values !== undefined && values.some((value) => value.toLowerCase() === EXTENSION_ID.toLowerCase());
}

function proposedApiValues(text: string): string[] | undefined {
	const match = new RegExp(`"${PROPOSED_API_KEY}"\\s*:\\s*\\[([^\\]]*)\\]`).exec(stripComments(text));
	if (!match) {
		return undefined;
	}

	return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

function withExtensionListed(text: string): string {
	const existing = new RegExp(`("${PROPOSED_API_KEY}"\\s*:\\s*\\[)([^\\]]*)(\\])`);
	if (existing.test(stripComments(text))) {
		return text.replace(existing, (_full, head: string, body: string, tail: string) => {
			const separator = body.trim().length > 0 ? ', ' : '';

			return `${head}${body.trimEnd()}${separator}"${EXTENSION_ID}"${tail}`;
		});
	}

	return withNewProperty(text);
}

function withNewProperty(text: string): string {
	const closing = text.lastIndexOf('}');
	if (closing < 0) {
		throw new Error('argv.json has no closing brace');
	}

	const head = text.slice(0, closing).replace(/\s+$/, '');
	const tail = text.slice(closing);
	const property = `\t"${PROPOSED_API_KEY}": ["${EXTENSION_ID}"]`;

	return `${withTrailingComma(head)}\n${property}\n${tail}`;
}

function withTrailingComma(head: string): string {
	const lines = head.split('\n');

	for (let index = lines.length - 1; index >= 0; index--) {
		const line = lines[index].trim();
		if (line.length === 0 || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
			continue;
		}

		if (!line.endsWith(',') && !line.endsWith('{')) {
			lines[index] = `${lines[index]},`;
		}

		break;
	}

	return lines.join('\n');
}

function assertParsable(text: string): void {
	JSON.parse(stripComments(text));
}

function stripComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"])\/\/.*$/gm, '$1');
}
