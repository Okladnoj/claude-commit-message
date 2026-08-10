#!/usr/bin/env bash
# Publishes the extension to the Visual Studio Marketplace (VS Code).
# Needs VSCE_PAT: an Azure DevOps token with Marketplace > Manage.
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

if [ -z "${VSCE_PAT:-}" ]; then
	echo "VSCE_PAT is not set. Create a token at https://dev.azure.com with the Marketplace > Manage scope."
	read -r -s -p "VSCE_PAT: " VSCE_PAT || true
	echo
fi

if [ -z "$VSCE_PAT" ]; then
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

vsce publish --packagePath "$VSIX" --pat "$VSCE_PAT" --allow-proposed-apis contribSourceControlInputBoxMenu

echo
echo "published: https://marketplace.visualstudio.com/items?itemName=${PUBLISHER}.${NAME}"
echo "Cursor and Antigravity read Open VSX instead — run ./deploy-openvsx.sh for them"
