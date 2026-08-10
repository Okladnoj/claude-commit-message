import * as vscode from 'vscode';
import { EXTENSION_ID, argvPath, enableButton, isButtonEnabled } from './argv';
import { log } from './output';

const DISMISSED_KEY = 'claudeCommit.setupDismissed';
const VERIFIED_KEY = 'claudeCommit.buttonVerified';

export class ButtonSetup implements vscode.Disposable {
	private readonly context: vscode.ExtensionContext;
	private readonly status: vscode.StatusBarItem;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
		this.status.name = 'Claude CLI Commit Message';
		this.status.command = 'claudeCommit.enableButton';
	}

	private get isListed(): boolean {
		return isButtonEnabled();
	}

	private get isVerified(): boolean {
		return this.isListed && this.context.globalState.get<boolean>(VERIFIED_KEY) === true;
	}

	private get isDismissed(): boolean {
		return this.context.globalState.get<boolean>(DISMISSED_KEY) === true;
	}

	dispose(): void {
		this.status.dispose();
	}

	async start(): Promise<void> {
		this.refreshStatus();

		if (this.isVerified) {
			log('the input box button is enabled and confirmed');
			return;
		}

		if (this.isListed) {
			log(`${argvPath()} lists ${EXTENSION_ID}, waiting for the first button press to confirm the restart happened`);
			return;
		}

		if (this.isDismissed) {
			log('the input box button is not enabled, the setup prompt is dismissed');
			return;
		}

		await this.offerSetup(false);
	}

	async runExplicit(): Promise<void> {
		await this.context.globalState.update(DISMISSED_KEY, false);

		if (this.isListed) {
			await this.offerRestart();
			this.refreshStatus();
			return;
		}

		await this.offerSetup(true);
		this.refreshStatus();
	}

	confirmWorking(): void {
		if (!this.isListed || this.isVerified) {
			return;
		}

		log('the input box button responded, setup reminders are off');
		void this.context.globalState.update(VERIFIED_KEY, true);
		this.status.hide();
	}

	private refreshStatus(): void {
		if (this.isVerified || this.isDismissed) {
			this.status.hide();
			return;
		}

		this.status.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');

		if (this.isListed) {
			this.status.text = '$(warning) Claude Commit: restart to finish';
			this.status.tooltip = `${argvPath()} is updated, but the button is not live yet. Quit ${vscode.env.appName} completely and start it again — reloading the window is not enough. This goes away once the button is pressed.`;
			this.status.show();
			return;
		}

		this.status.text = '$(warning) Claude Commit: button disabled';
		this.status.tooltip = 'The Source Control input box button is not enabled yet. Click to set it up.';
		this.status.show();
	}

	private async offerSetup(explicit: boolean): Promise<void> {
		const dismissLabel = explicit ? 'Not now' : 'Never ask again';
		const answer = await vscode.window.showInformationMessage(
			`Claude CLI Commit Message puts its button inside the Source Control input box. ${vscode.env.appName} allows that only for extensions listed in argv.json. Add it there?`,
			'Add and restart',
			'Open argv.json',
			dismissLabel,
		);

		if (answer === 'Open argv.json') {
			void vscode.commands.executeCommand('workbench.action.configureRuntimeArguments');
			return;
		}

		if (answer === dismissLabel && !explicit) {
			await this.dismiss();
			return;
		}

		if (answer !== 'Add and restart') {
			return;
		}

		await this.applySetup();
	}

	private async offerRestart(): Promise<void> {
		const answer = await vscode.window.showInformationMessage(
			`Claude CLI Commit Message is already listed in ${argvPath()}. If the button is still missing, quit ${vscode.env.appName} completely and start it again — reloading the window is not enough.`,
			'Quit now',
			'Open argv.json',
			'Stop reminding',
		);

		if (answer === 'Open argv.json') {
			void vscode.commands.executeCommand('workbench.action.configureRuntimeArguments');
			return;
		}

		if (answer === 'Stop reminding') {
			await this.dismiss();
			return;
		}

		if (answer !== 'Quit now') {
			return;
		}

		void vscode.commands.executeCommand('workbench.action.quit');
	}

	private async applySetup(): Promise<void> {
		try {
			enableButton();
			log(`listed ${EXTENSION_ID} in ${argvPath()}`);
		} catch (error) {
			this.reportSetupFailure(error);
			return;
		}

		this.refreshStatus();

		const answer = await vscode.window.showInformationMessage(
			`Claude CLI Commit Message: ${argvPath()} updated. Quit ${vscode.env.appName} and start it again — reloading the window is not enough.`,
			{ modal: true },
			'Quit now',
		);

		if (answer !== 'Quit now') {
			return;
		}

		void vscode.commands.executeCommand('workbench.action.quit');
	}

	private async dismiss(): Promise<void> {
		await this.context.globalState.update(DISMISSED_KEY, true);
		this.status.hide();
		log('setup reminders are off, run "Claude Commit: Enable the Source Control Input Box Button" to bring them back');
	}

	private reportSetupFailure(error: unknown): void {
		const reason = error instanceof Error ? error.message : String(error);
		log(`failed to update argv.json: ${reason}`);

		vscode.window
			.showErrorMessage(
				`Claude CLI Commit Message: could not update argv.json (${reason}). Add "enable-proposed-api": ["${EXTENSION_ID}"] manually.`,
				'Open argv.json',
			)
			.then((action) => {
				if (action !== 'Open argv.json') {
					return;
				}

				void vscode.commands.executeCommand('workbench.action.configureRuntimeArguments');
			});
	}
}
