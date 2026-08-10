# Changelog

## 0.4.5

- Stop trusting the stored confirmation on its own. A press of the generate
  command was taken as proof that the proposed API is granted, but the editor
  also routes that command through the input box last-action mechanism, so the
  extension could mark itself as set up while the button was never rendered —
  and then stay silent forever. The confirmation now only counts while the
  entry is actually present in `argv.json`.

## 0.4.4

- Make the unfinished setup impossible to miss: the status bar entry now carries
  the warning colour and a warning icon, and says `restart to finish` while the
  `argv.json` entry is in place but the editor has not been restarted yet.

## 0.4.3

- Bring the `argv.json` setup back. Dropping it in 0.4.0 was a mistake: the
  button only kept working because the entry written by an earlier version was
  still in effect in the running editor. Without it the input box menu is never
  rendered — `scm/inputBox` stays a proposed API.

## 0.4.2

- Rename the extension to `claude-cli-commit-message`: the Marketplace keeps
  extension names unique across every publisher, and `claude-commit-message`
  was already taken. The identifier is now `OKJI.claude-cli-commit-message`.

## 0.4.1

- Show the running bar in the Source Control view title, where the other
  extensions put theirs. The status bar spinner from 0.4.0 was too quiet to
  notice.

## 0.4.0

- Drop the whole `argv.json` setup: the notification on the first run, the
  status bar reminder and the
  `Claude Commit: Enable the Source Control Input Box Button` command are gone.
  The input box button turns out to work without listing the extension in
  `enable-proposed-api`, so the setup was fixing a problem that does not exist.
- Report progress where the click happened: the input box placeholder reads
  `Claude is writing a commit message…` while the run is in flight, and the
  progress itself moved from a notification in the far corner to the status bar.
  Cancelling stays on the spinning button inside the input box.

## 0.3.0

- The button now lives inside the Source Control input box, where the commit
  message is typed.
- That menu is a VS Code proposed API, so the extension asks once for
  permission and adds itself to `enable-proposed-api` in `argv.json`. Comments
  in that file are preserved, a `.bak` copy is kept, and the edit is idempotent.
- `Claude Commit: Enable the Source Control Input Box Button` repeats the setup
  at any time. Until it is done, generation is available from the command
  palette.

## 0.2.0

- Spin the button while a message is being generated: the sparkle is swapped
  for a spinning indicator, and clicking it cancels the run.
- Refuse to start a second generation while one is still running.

## 0.1.3

- Return the message as soon as the CLI is done. The watchdog of
  `gen-commit-msg.sh` inherited stdout and kept the pipe open, so every
  generation waited for the full timeout before the result arrived.
- Show the progress as a cancellable notification instead of a Source Control
  indicator, and log how long a generation took.

## 0.1.2

- Describe untracked files when neither the index nor the working tree has a
  diff, so a repository without a first commit is no longer reported as empty.

## 0.1.1

- Move the button to the Source Control title bar: the input box menu is a
  proposed API available to GitHub Copilot Chat only, so the button was never
  rendered there.
- Fall back to the repository of the active editor when the command is invoked
  without a Source Control context.

## 0.1.0

- Sparkle button in the Source Control input box that writes a commit message with the local `claude` CLI.
- Falls back to the unstaged diff when nothing is staged, with a warning.
- `prepare-commit-msg` hook and the `Claude Commit: Install prepare-commit-msg Hook` command for terminal and third-party git clients.
- Settings: `claudePath`, `model`, `diffLimit`, `timeoutSec`, `recentCommits`.
- Diagnostics in the `Claude Commit Message` output channel.
