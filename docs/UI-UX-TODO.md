# UI/UX release pass

This checklist tracks the July 2026 usability and visual-quality pass. Items are only checked after implementation and Playwright verification.

## Application shell

- [x] Reserve a safe macOS traffic-light area and restore a useful drag region.
- [x] Present the Knot app icon and workspace identity clearly without crowding navigation.
- [x] Replace the workspace dropdown with a polished, keyboard-accessible menu.
- [x] Verify open, create, reveal, refresh, and tutorial workspace actions.
- [x] Normalize type scale, spacing, control heights, focus rings, and page widths.

## Core experiences

- [x] Auto-layout the knowledge graph with readable edges, collision avoidance, and fit-to-view controls.
- [x] Make graph filters, search, selection, and reset controls functional.
- [x] Redesign Web Watch around progressive disclosure: updates, watches, and connection.
- [x] Remove excess whitespace from workflow recipes and approval states.
- [x] Audit every remaining page at standard and compact desktop sizes.

## Guided learning

- [x] Add an on-demand, resumable product walkthrough.
- [x] Load a safe example workspace for the walkthrough.
- [x] Walk through every primary product area with Back, Next, Skip, and progress controls.
- [x] Support keyboard navigation, focus management, and reduced motion.

## Release verification

- [x] Add functional Playwright coverage for menu actions, graph controls, page flows, and the tour.
- [x] Capture and inspect screenshots for every primary page at multiple viewport sizes.
- [x] Run collaborative persona simulations against isolated workspaces.
- [x] Run typecheck, unit tests, full Electron Playwright suite, packaging, and packaged smoke tests.
