# Build OsmiumDemo.app, the native demo: the web demo's one-window pages
# as Osmium windows, hosted by macos/OsmiumWindows.swift. Needs the
# Command Line Tools (no Xcode project) and, for npm run demo:build,
# Node with the repo's npm dependencies installed (npm install).
APP := OsmiumDemo.app
DIST := ../dist
PAGES := controls.html finder.html panel.html appearance.html about.html
SOURCES := main.swift ../../macos/OsmiumWindows.swift
# Name the deployment target (the macOS 12 in Info.plist) in the target
# triple rather than relying on MACOSX_DEPLOYMENT_TARGET: without it,
# swiftc may build for the running macOS, and availability checks would
# then let through APIs newer than macOS 12.
TARGET := $(shell uname -m)-apple-macos12.0
# Swift language mode. CI also builds with SWIFT_VERSION=6 and
# SWIFTFLAGS=-warnings-as-errors, which keeps this code and the window
# host ready for Swift 6's stricter concurrency checks.
SWIFT_VERSION ?= 5
SWIFTFLAGS ?=

all: $(APP)

$(APP): web Info.plist $(SOURCES)
	@for f in $(PAGES); do \
		test -f $(DIST)/$$f || { echo "npm run demo:build wrote no $(DIST)/$$f" >&2; exit 1; }; \
	done
	rm -rf $(APP).staging
	mkdir -p $(APP).staging/Contents/MacOS $(APP).staging/Contents/Resources
	cp Info.plist $(APP).staging/Contents/
	cp -R $(DIST) $(APP).staging/Contents/Resources/web
	swiftc -O -swift-version $(SWIFT_VERSION) $(SWIFTFLAGS) -target $(TARGET) \
		-o $(APP).staging/Contents/MacOS/OsmiumDemo $(SOURCES)
	rm -rf $(APP) && mv $(APP).staging $(APP)
	codesign --force --sign - $(APP)
	@echo "Built $(APP)"

web:
	cd ../.. && npm run demo:build

run: $(APP)
	open $(APP)

clean:
	rm -rf $(APP) $(APP).staging

.PHONY: all web run clean
