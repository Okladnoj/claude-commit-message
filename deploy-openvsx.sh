#!/usr/bin/env bash
# Publishes the extension to Open VSX — the registry Cursor, Antigravity,
# Windsurf and VSCodium install from.
# Reads the token from OVSX_PAT or OPEN_VSX_TOKEN, otherwise asks for it.
# Usage: ./deploy-openvsx.sh [path/to.vsix] [--yes]
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

ovsx() {
	if command -v ovsx >/dev/null 2>&1; then
		command ovsx "$@"
		return
	fi

	npx --yes ovsx "$@"
}

OVSX_PAT="${OVSX_PAT:-${OPEN_VSX_TOKEN:-}}"

if [ -z "$OVSX_PAT" ]; then
	echo "Neither OVSX_PAT nor OPEN_VSX_TOKEN is set. Sign in with GitHub, then:"
	echo "  https://open-vsx.org/user-settings/tokens -> Generate New Token"
	echo "  The ${PUBLISHER} namespace already exists — no create-namespace needed"
	read -r -s -p "OVSX_PAT: " OVSX_PAT || true
	echo
fi

if [ -z "$OVSX_PAT" ]; then
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
echo "publishing ${PUBLISHER}.${NAME} ${VERSION} to Open VSX (Cursor, Antigravity, Windsurf, VSCodium)"
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

if ! ovsx publish "$VSIX" --pat "$OVSX_PAT"; then
	echo
	echo "if it failed on an unknown namespace, claim it once:" >&2
	echo "  ovsx create-namespace ${PUBLISHER} --pat \$OVSX_PAT" >&2
	exit 1
fi

echo
echo "published: https://open-vsx.org/extension/${PUBLISHER}/${NAME}"
