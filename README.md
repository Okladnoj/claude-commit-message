# Claude Commit Message

Generate commit messages with the local Claude CLI, straight from the Source
Control panel of VS Code or Cursor.

## One-time setup

The button sits inside the Source Control input box. That menu is a VS Code
proposed API, and the editor only grants it to extensions listed in
`argv.json`. On the first run the extension offers to add itself there; it
keeps a `.bak` copy of the file and leaves your comments untouched. The change
takes effect after the editor is quit and started again — reloading the window
is not enough.

Until the setup is finished, a `Claude Commit` entry in the status bar says what
is still missing — the `argv.json` change itself, or the restart that activates
it. Clicking it, or running `Claude Commit: Enable the Source Control Input Box
Button`, resumes the setup at any point, including after `Never ask again`. The
entry goes away for good once the button is pressed and proves to work.

Until then, generation still works from the command palette via
`Claude Commit: Generate Commit Message`.

## How it works

1. Press the sparkle button in the Source Control input box, where you type
   the commit message. While Claude is working, the icon spins; clicking it
   again cancels the run.
2. The extension takes the staged diff, the current branch, a diffstat and the
   recent commit subjects, and sends them to `claude -p`.
3. The generated message lands in the input box, where you can edit it before
   committing.

When nothing is staged, the unstaged diff is used instead; when that is empty
too, the untracked files are described. Both cases come with a warning, so it
is always clear what the message is based on.

## Requirements

- The `claude` CLI, already authorized. No API key and no extra configuration.
- If the CLI is not on the PATH of the editor process (a common case for GUI
  apps on macOS), set `claudeCommit.claudePath` to its absolute path — run
  `which claude` in a terminal to find it.

## Git hook

`Claude Commit: Install prepare-commit-msg Hook` copies `prepare-commit-msg`
and `gen-commit-msg.sh` into the `.git/hooks` directory of the chosen
repository. After that, `git commit` without `-m` fills the message
automatically, from the terminal and from any git client.

The hook is local to the clone: it is not versioned and it is gone after a
re-clone. Skip it for a single commit with `CLAUDE_COMMIT_MSG=0 git commit`.

Use either the button or the hook. With both enabled, committing from the
Source Control panel with an already generated message keeps that message —
the hook only fills an empty one — but committing from the terminal after
pressing the button is not the flow either of them is designed for.

## Settings

| Key | Default | Purpose |
| --- | --- | --- |
| `claudeCommit.claudePath` | `claude` | path to the CLI |
| `claudeCommit.model` | `sonnet` | model passed to `claude -p` |
| `claudeCommit.diffLimit` | `60000` | diff cut-off in characters |
| `claudeCommit.timeoutSec` | `90` | timeout of a single call |
| `claudeCommit.recentCommits` | `8` | commit subjects sent as a style reference |

## Message format

- Conventional Commits, `type(scope): Subject`.
- Subject in English, capitalized, imperative mood, no trailing period, at most
  72 characters.
- A body only when the change is not self-evident.
- No `Co-Authored-By` trailer and no mention of AI.

## Diagnostics

Everything the extension does is logged to the `Claude Commit Message` output
channel: prompt size, exit codes, the stderr of the CLI. Error notifications
carry a `Show Output` button.

## Install from a `.vsix`

```sh
./package.sh
code --install-extension dist/claude-cli-commit-message-<version>.vsix
```

`./deploy-vscode.sh` publishes to the Visual Studio Marketplace and
`./deploy-openvsx.sh` to Open VSX, which is what Cursor, Antigravity, Windsurf
and VSCodium install from. Both pass `--allow-proposed-apis`, because the
manifest declares `enabledApiProposals`.

In Cursor, use the `Extensions: Install from VSIX…` command.
