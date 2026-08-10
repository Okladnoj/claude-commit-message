#!/usr/bin/env bash
# Publishes the extension to the Visual Studio Marketplace (VS Code).
# Uses the token stored by `vsce login <publisher>`; falls back to VSCE_PAT or
# to a prompt when no publisher is logged in.
# Usage: ./deploy-vscode.sh [path/to.vsix] [--yes]
set -euo pipefail

cd "$(dirname "$0")"

NAME=$(node -p "require('./package.json').name")
VERSION=$(node -p "require('./package.json').version")
PUBLISHER=$(node -p "require('./package.json').publisher")

VSIX=""
ASSUME_YES=0

for argument in "$@"; do
	if [ "$argument" = "--yes" ] || [ "$argument" = "-y" ]; then
		ASSUME_YES=1
		continue
	fi

	VSIX="$argument"
done

vsce() {
	if command -v vsce >/dev/null 2>&1; then
		command vsce "$@"
		return
	fi

	npx --yes @vscode/vsce "$@"
}

is_logged_in() {
	vsce ls-publishers 2>/dev/null | grep -qx "$PUBLISHER"
}

if [ -z "${VSCE_PAT:-}" ] && ! is_logged_in; then
	echo "${PUBLISHER} is not logged in and VSCE_PAT is not set."
	echo "Token comes from Azure DevOps, not the Azure Portal:"
	echo "  https://dev.azure.com -> User settings -> Personal access tokens -> New Token"
	echo "  Organization: All accessible organizations, Scopes: Custom defined -> Marketplace -> Manage"
	echo "  The publisher must already exist at https://marketplace.visualstudio.com/manage"
	echo "  A one-off login keeps it in the keychain: vsce login ${PUBLISHER}"
	read -r -s -p "VSCE_PAT: " VSCE_PAT || true
	echo
fi

if [ -z "${VSCE_PAT:-}" ] && ! is_logged_in; then
	echo "no token, cancelled" >&2
	exit 1
fi

if [ -z "$VSIX" ]; then
	./package.sh
	VSIX="dist/${NAME}-${VERSION}.vsix"
fi

if [ ! -f "$VSIX" ]; then
	echo "no such package: ${VSIX}" >&2
	exit 1
fi

echo
echo "publishing ${PUBLISHER}.${NAME} ${VERSION} to the Visual Studio Marketplace"
echo "package: ${VSIX}"
echo "a published version is permanent — it can be unlisted, never replaced"

if [ "$ASSUME_YES" -eq 0 ]; then
	read -r -p "continue? [y/N] " answer
	case "$answer" in
		y | Y | yes | YES) ;;
		*)
			echo "cancelled"
			exit 1
			;;
	esac
fi

publish() {
	if [ -n "${VSCE_PAT:-}" ]; then
		vsce publish --packagePath "$VSIX" --pat "$VSCE_PAT" --allow-proposed-apis contribSourceControlInputBoxMenu
		return
	fi

	vsce publish --packagePath "$VSIX" --allow-proposed-apis contribSourceControlInputBoxMenu
}

if ! publish; then
	echo
	echo "read the error above, the usual causes are:" >&2
	echo "  expired token — issue a new one at https://dev.azure.com (User settings ->" >&2
	echo "    Personal access tokens, All accessible organizations, Marketplace > Manage)," >&2
	echo "    then store it with: vsce login ${PUBLISHER}" >&2
	echo "  taken name — the 'name' field in package.json is unique across the whole" >&2
	echo "    Marketplace, not just within the publisher" >&2
	echo "  version already published — bump the version in package.json" >&2
	exit 1
fi

echo
echo "published: https://marketplace.visualstudio.com/items?itemName=${PUBLISHER}.${NAME}"
echo "Cursor and Antigravity read Open VSX instead — run ./deploy-openvsx.sh for them"
