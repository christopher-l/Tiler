#!/usr/bin/env bash

set -e

PACK_FILE="tiler@luchrioh.shell-extension.zip"

function clear() (
	if [ -d target ]; then
		rm -r target
	fi
)

function compile() (
	tsc --project tsconfig.build.json
)

function fixupJavaScript() (
	for file in $(find target -name '*.js'); do
		sed -i \
			-e 's#export function#function#g' \
			-e 's#export var#var#g' \
			-e 's#export const#var#g' \
			-e 's#Object.defineProperty(exports, "__esModule", { value: true });#var exports = {};#g' \
			"${file}"
		sed -i -E 's/export class (\w+)/var \1 = class \1/g' "${file}"
		sed -i -E "s/import \* as (\w+) from '(.+)'/const \1 = Me.imports.\2/g" "${file}"
		# Replace import statements of the style "import { Foo } from 'foo';".
		sed -i -E "s/^import \{(.*)\} from 'imports\/(.*)';$/const {\1} = imports.\2;/g" "${file}"
		sed -i -E "s/^import \{(.*)\} from '(.*)';$/const {\1} = Me.imports.\2;/g" "${file}"
		# Replace slashes with dots in lines containing "Me.imports.".
		sed -i -E "/^const .* = Me\.imports\..*;/ s/(\w)\/(\w)/\1.\2/g" "${file}"
		# Prepend import for `Me` if not already there.
		if ! grep -qe "^const Me =" ${file}; then
			echo -e "const Me = imports.misc.extensionUtils.getCurrentExtension();\n$(cat ${file})" >${file}
		fi
	done
)

function compileUi() (
	mkdir target/ui
	cd src/ui
	for f in *.blp; do
		echo $f
		blueprint-compiler compile $f >../../target/ui/$(basename $f .blp).ui
	done
)

function compileSchemas() (
	cp -r src/schemas target/schemas
	glib-compile-schemas src/schemas --targetdir target/schemas
)

function copyAdditionalFiles() (
	for file in metadata.json README.md; do
		cp "$file" "target/$file"
	done

	(
		cd src
		for file in stylesheet.css; do
			cp "$file" "../target/$file"
		done
	)
)

function pack() (
	gnome-extensions pack target --force $(
		cd target
		for file in *; do echo "--extra-source=$file"; done
	)
	echo "Packed $PACK_FILE"
)

function install() (
	gnome-extensions install --force "$PACK_FILE"
	echo "Installed $PACK_FILE"
)

function main() (
	cd "$(dirname ${BASH_SOURCE[0]})"
	clear
	compile
	fixupJavaScript
	compileUi
	compileSchemas
	copyAdditionalFiles
	pack
	while getopts i flag; do
		case $flag in
		i) install ;;
		esac
	done
)

main "$@"
