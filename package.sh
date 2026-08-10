#!/usr/bin/env bash
# Builds the extension and writes dist/<name>-<version>.vsix.
set -euo pipefail

cd "$(dirname "$0")"

NAME=$(node -p "require('./package.json').name")
VERSION=$(node -p "require('./package.json').version")
VSIX="dist/${NAME}-${VERSION}.vsix"

vsce() {
	if command -v vsce >/dev/null 2>&1; then
		command vsce "$@"
		return
	fi

	npx --yes @vscode/vsce "$@"
}

if [ ! -d node_modules ]; then
	echo "==> installing dependencies"
	npm ci
fi

echo "==> compiling"
npm run compile

echo "==> packaging ${NAME} ${VERSION}"
mkdir -p dist
vsce package --out "$VSIX"

echo
echo "built ${VSIX}"
echo "install locally:  code --install-extension ${VSIX}"
echo "                  cursor --install-extension ${VSIX}"
