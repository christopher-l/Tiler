# Tiler

GNOME Shell extension for i3-inspired window tiling.

## Build

The source code of this extension is written in TypeScript. The following command will build the
extension and package it to a zip file.

```sh
./build.sh
```

## Install

The following command will build the extension and install it locally.

```sh
./build.sh -i
```

## Generate types

For development with TypeScript, you can get type support in IDEs like VSCode by building and
installing type information for used libraries. Generating types is optional and not required for
building the extension. (For that, we use a different configuration that stubs type information with
dummy types.)

In any directory, run:

```sh
git clone https://github.com/sammydre/ts-for-gjs
cd ts-for-gjs
npm install
npm run build
npm link
```

Back in the project, run:

```sh
ts-for-gir generate Gio-2.0 GObject-2.0 St-1.0 Shell-0.1 Meta-10 Adw-1 -g "/usr/share/gir-1.0" -g "/usr/share/gnome-shell" -g "/usr/lib/mutter-10/"
```

Choose "All" and "Yes" for everything.
