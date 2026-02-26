{
  description = "PaperShelf - A native-feeling desktop app for organizing research papers";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };

        isLinux = pkgs.stdenv.isLinux;
        isDarwin = pkgs.stdenv.isDarwin;

        # Linux-specific runtime libraries for Electron
        linuxRuntimeLibs = with pkgs; [
          glib
          gtk3
          nss
          nspr
          atk
          at-spi2-atk
          libdrm
          expat
          libxkbcommon
          libx11
          libxcomposite
          libxdamage
          libxext
          libxfixes
          libxrandr
          libxcb
          mesa
          libgbm
          libGL
          alsa-lib
          cups
          dbus
          pango
          cairo
          udev
          libnotify
        ];

        # Common dependencies for both platforms
        commonDeps = with pkgs; [
          nodejs_20
          python3
          gnumake
          pkg-config
          sqlite
        ];

        # Platform-specific build dependencies
        linuxBuildDeps = with pkgs; [
          gcc
          electron
          poppler-utils
        ] ++ linuxRuntimeLibs;

        darwinBuildDeps = with pkgs; [
          darwin.cctools
          poppler
        ];

        buildDeps = commonDeps
          ++ (if isLinux then linuxBuildDeps else [])
          ++ (if isDarwin then darwinBuildDeps else []);

        libPath = if isLinux then pkgs.lib.makeLibraryPath linuxRuntimeLibs else "";

        # Wrapper script to run the app
        papershelf = pkgs.writeShellScriptBin "papershelf" ''
          set -e

          PROJECT_DIR="''${PAPERSHELF_PROJECT_DIR:-$(pwd)}"

          if [ ! -f "$PROJECT_DIR/package.json" ]; then
            echo "Error: package.json not found in $PROJECT_DIR"
            echo "Run this command from the PaperShelf project directory,"
            echo "or set PAPERSHELF_PROJECT_DIR to the project path."
            exit 1
          fi

          cd "$PROJECT_DIR"

          # Set up environment
          export PATH="${pkgs.nodejs_20}/bin:$PROJECT_DIR/node_modules/.bin:$PATH"
          export npm_config_build_from_source=true
          export SQLITE3_INCLUDE_DIR="${pkgs.sqlite.dev}/include"
          export SQLITE3_LIB_DIR="${pkgs.sqlite.out}/lib"
          ${if isLinux then ''
          export LD_LIBRARY_PATH="${libPath}:$LD_LIBRARY_PATH"
          export ELECTRON_OZONE_PLATFORM_HINT=auto
          '' else ""}

          # Install dependencies if needed
          if [ ! -d "node_modules" ]; then
            echo "Installing dependencies..."
            ${pkgs.nodejs_20}/bin/npm install
          fi

          # Run the app
          echo "Starting PaperShelf..."
          exec ${pkgs.nodejs_20}/bin/npm run dev
        '';

        # Build script (builds but doesn't run)
        papershelf-build = pkgs.writeShellScriptBin "papershelf-build" ''
          set -e
          PROJECT_DIR="''${PAPERSHELF_PROJECT_DIR:-$(pwd)}"

          if [ ! -f "$PROJECT_DIR/package.json" ]; then
            echo "Error: package.json not found in $PROJECT_DIR"
            exit 1
          fi

          cd "$PROJECT_DIR"

          export PATH="${pkgs.nodejs_20}/bin:$PROJECT_DIR/node_modules/.bin:$PATH"
          export npm_config_build_from_source=true
          export SQLITE3_INCLUDE_DIR="${pkgs.sqlite.dev}/include"
          export SQLITE3_LIB_DIR="${pkgs.sqlite.out}/lib"
          ${if isLinux then ''
          export LD_LIBRARY_PATH="${libPath}:$LD_LIBRARY_PATH"
          '' else ""}

          if [ ! -d "node_modules" ]; then
            echo "Installing dependencies..."
            ${pkgs.nodejs_20}/bin/npm install
          fi

          echo "Building PaperShelf..."
          ${pkgs.nodejs_20}/bin/npm run build
          echo "Build complete! Output in dist/"
        '';
      in
      {
        packages = {
          default = papershelf;
          build = papershelf-build;
        };

        apps = {
          default = {
            type = "app";
            program = "${papershelf}/bin/papershelf";
          };
          build = {
            type = "app";
            program = "${papershelf-build}/bin/papershelf-build";
          };
        };

        devShells.default = pkgs.mkShell {
          buildInputs = buildDeps;

          shellHook = ''
            # Set up npm to use local node_modules/.bin
            export PATH="$PWD/node_modules/.bin:$PATH"

            # Fix for native module compilation
            export npm_config_build_from_source=true
            ${if isLinux then ''
            # Required for Electron on Linux
            export ELECTRON_OZONE_PLATFORM_HINT=auto

            # Help native modules find system libraries
            export LD_LIBRARY_PATH="${libPath}:$LD_LIBRARY_PATH"
            '' else ""}
            echo "PaperShelf development environment loaded"
            echo "Run 'npm install' to install dependencies"
            echo "Run 'npm run dev' to start development server"
          '';

          # Environment variables for better-sqlite3
          SQLITE3_INCLUDE_DIR = "${pkgs.sqlite.dev}/include";
          SQLITE3_LIB_DIR = "${pkgs.sqlite.out}/lib";
        };
      }
    );
}
