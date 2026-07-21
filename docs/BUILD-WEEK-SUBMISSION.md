# OpenAI Build Week submission readiness

Last audited: 2026-07-20

Submission deadline: **Tuesday, July 21, 2026 at 5:00 PM Pacific / 7:00 PM Central**.

Official event: [OpenAI Build Week](https://openai.devpost.com)  
Official rules: [openai.devpost.com/rules](https://openai.devpost.com/rules)  
Video FAQ: [openai.devpost.com/details/faqs](https://openai.devpost.com/details/faqs)

## Submission position

Submit Knot to **Work & Productivity**.

One-sentence positioning:

> Knot is a local-first control plane for knowledge shared between people and AI agents: portable through Google's Open Knowledge Format, selectively disclosed, revision-aware, and protected by human review.

The product is ready to demonstrate. The remaining work is submission packaging, public evidence, and the submitter-only declarations listed below.

## User-only actions

These steps require the submitter's identity, personal declarations, voice, or acceptance of legal terms and must not be completed by an agent without explicit approval.

- [x] Register for OpenAI Build Week on Devpost.
- [ ] Confirm age, country-of-residence eligibility, and agreement to the official rules.
- [ ] Choose submitter type: individual, team, or organization.
- [ ] Choose team status and provide the requested registration answers about AI models, Codex experience, and the work.
- [ ] Record the approved English narration. A clean WAV, M4A, or high-quality MP3 is sufficient.
- [ ] Review the final project description in the submitter's own voice.
- [ ] Review the final Devpost preview and explicitly submit it before the deadline.

## Repository and build evidence

- [ ] Initialize this directory as a Git repository. It is not currently a Git worktree.
- [ ] Create an intentional first commit without rewriting or fabricating history.
- [ ] Publish the repository to GitHub.
- [ ] If public, verify that `LICENSE` and all required source are present.
- [ ] If private, grant repository access to `testing@devpost.com` and `build-week-event@openai.com`.
- [ ] Add a Build Week section to `README.md` covering:
  - the problem and target audience;
  - why OKF and local-first storage were selected;
  - where Codex accelerated implementation and research;
  - the specific GPT-5.6 contribution;
  - major product and security decisions;
  - judge setup, sample data, and a short test path.
- [ ] Preserve genuine dated evidence that the project was built during the submission period, using the Codex task, filesystem timestamps, and the new Git history. Do not manufacture earlier commits.
- [x] Run one documented, meaningful GPT-5.6 implementation or release-audit pass before submission.
- [ ] Verify the model actually used in that pass and describe only observed behavior. Do not infer the model from a generic Codex connection.
- [x] Run `/feedback` in the primary Codex build task and retain the Session ID where most core functionality was built.
- [x] Add the `/feedback` Session ID to the Devpost submission materials.
- [ ] Check the repository for real credentials, exported bearer capabilities, local app data, and user-specific paths before publishing.
- [ ] Revoke or rotate temporary Daytona and Parallel test credentials after the final live tests. Never commit them.

## Final product verification

- [x] Run `npm run test:ship` from the current release dependency lockfile.
- [ ] Run the signed-in live Codex app-server test and retain non-secret evidence.
- [ ] Run the live Parallel monitor lifecycle and cancel its test monitor afterward.
- [ ] Run the live Daytona lifecycle and confirm its test sandbox is deleted afterward.
- [ ] Run `npm run dist` and the packaged macOS smoke test.
- [x] Confirm the example workspace and guided tour still work in the exact demo build.
- [x] Confirm the scripted paths contain no loading failures, empty states, clipped content, layout shifts, or accidental secret disclosure.
- [x] Record the exact test totals from the final gate; do not reuse stale counts from an earlier audit.
- [ ] Decide how to describe Windows honestly. Cross-built Windows artifacts are not equivalent to native Windows execution evidence.

## Judge access

- [ ] Create a GitHub Release or another durable download containing the evaluation build.
- [ ] Include the macOS ZIP and checksum. Clearly label it as unsigned if signing and notarization are not completed.
- [ ] Provide the source-run fallback:

  ```bash
  npm install
  npm run dev
  ```

- [ ] State the supported Node.js and npm versions.
- [ ] Explain that the sample workspace opens automatically and that provider API keys are not needed for the core walkthrough.
- [ ] Provide an optional judge path for live features without publishing any credential.
- [ ] Verify every judge-facing URL from a signed-out browser session.

## Demo video production

Required constraints:

- public YouTube video;
- English narration;
- three minutes or less;
- clear footage of the working project;
- specific explanation of what was built, how Codex was used, and how GPT-5.6 was used.

Production tasks:

- [x] Approve the narration script and visual storyboard.
- [x] Record the narration with short pauses between sections.
- [x] Normalize the voice track and generate word-level timestamps.
- [x] Create a demo-only Playwright path with deterministic sample data and a fixed 16:9 Electron window.
- [x] Add a visible presentation cursor with smooth moves, hover pauses, click feedback, and restrained focus highlights.
- [x] Record the deterministic scene sequence from the real Electron application.
- [x] Capture the following story beats:
  1. the loss-of-control problem;
  2. local OKF workspace and knowledge graph;
  3. privacy and audience at authoring time;
  4. revision-aware recipient notification and the keep-private/publish choice;
  5. portable, synced-folder, self-hosted, and Daytona publication choices;
  6. scoped MCP access and proposal-only agent writes;
  7. cited Web Watch updates and approval-gated ingestion;
  8. subscription-backed, read-only Knot Assist;
  9. Codex/GPT-5.6 engineering contribution and test evidence;
  10. concise closing promise.
- [x] Assemble narration, application footage, titles, transitions, and HyperFrames-timed sidecar captions.
- [x] Render a 1920×1080 MP4 with FFmpeg-compatible YouTube settings.
- [x] Verify word synchronization, cursor alignment, readable text, audio peaks, and no dead air.
- [x] Confirm the final duration is safely below three minutes.
- [ ] Watch the complete render at normal speed and once without audio.
- [ ] Upload to YouTube as public and verify playback from a signed-out session.

Hosting and provider setup should not consume the demonstration. Core features will use deterministic sample data. The narration will state that users bring their own Daytona or Parallel keys, while the screen shows the already-configured product surface and real lifecycle behavior. Deployment choices are a short proof point, not the central story.

## Devpost project materials

- [x] Create the Knot Devpost project.
- [x] Select **Work & Productivity** in the prepared submission answers.
- [x] Add a concise project title and tagline.
- [x] Draft the description around problem, solution, differentiation, implementation, impact, and Build Week work.
- [ ] Add the GitHub repository URL.
- [x] Add the `/feedback` Session ID to the prepared submission answers.
- [x] Add the public YouTube URL.
- [x] Prepare and upload a 16:9 Knot cover.
- [x] Add judge source-run and test instructions.
- [x] List the technologies accurately: Electron, React, TypeScript, OKF, MCP, Codex app-server, GPT-5.6, Playwright, Daytona, Parallel, and FFmpeg/HyperFrames for the demo.
- [x] Credit Google for the Open Knowledge Format and state that Knot is an independent implementation.
- [ ] Avoid claiming that named capability links authenticate identity or that a stopped Daytona sandbox wakes when a link is opened.
- [ ] Avoid presenting researched roadmap items, including direct Notion sync, as shipped integrations.

## Final submission audit

- [ ] Project page is complete rather than saved only as a draft.
- [ ] Category, submitter type, and country fields are populated.
- [ ] Repository permissions work for judges.
- [ ] README setup succeeds on a clean machine.
- [ ] Video is public, plays correctly, and remains under three minutes.
- [ ] Video narration explicitly covers Knot, Codex, and GPT-5.6.
- [ ] `/feedback` Session ID is present and valid.
- [ ] Product claims match the tested build and documented limitations.
- [ ] No secrets or live capability URLs appear in the repository, video, screenshots, logs, or submission copy.
- [ ] Submit button has been used and Devpost shows a submitted confirmation before the deadline.
