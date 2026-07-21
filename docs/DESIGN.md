# Product design decisions

Reviewed 2026-07-17 against the complete desktop product at 1480×940 and the supported minimum of 1120×720, in light, dark, and system themes.

## Restraint over generated-dashboard conventions

Knot uses status text, table metadata, dividers, and hierarchy before decorative containers. The current pass removed the most common generated-UI signals:

- status and metadata no longer sit in rounded badge/pill capsules;
- graph filters use a conventional tab underline rather than filter pills;
- workflow stages are a structured checklist, not a row of colored chips;
- Cloud and Web watch status use one divided status surface instead of three floating cards;
- decorative radial and marketing gradients were removed; gradients remain only where they encode graph texture or measured progress;
- corner radii and shadows are quieter, and nested panels rely on borders and spacing;
- provider availability choices are comparable rows with explicit semantics, not a grid of promotional feature cards.

Chips remain appropriate for user-entered tokens, filters, or compact multi-select input. Notification counts may use a compact count marker. Neither is used as general decoration.

References used for the audit:

- [Material 3 chip guidance](https://m3.material.io/components/chips/guidelines)
- [Material 3 card guidance](https://m3.material.io/components/cards/guidelines)
- [Twilio Paste badge guidance](https://paste.twilio.design/components/badge)
- [Impeccable UI slop catalog](https://impeccable.style/slop)

## Interaction promises

- A sharing-intent label is policy, not proof of delivery or authentication.
- A named Daytona link is a revocable bearer capability, not a named login.
- A provider-synced folder uses the provider's actual identity controls.
- A stopped Daytona link does not wake its sandbox.
- Public publication always requires an explicit selection, matching sharing intent, and confirmation.
- External and AI-authored changes always stop in a review queue before an OKF write.

## Layout and accessibility

The application shell owns the viewport, while `.content` is the human-scrollable page region. Sidebar navigation has its own bounded scroll area. Long Cloud, Sharing, Workflows, and Web watch pages are tested with wheel and keyboard at 1120×720. Reduced-motion preferences collapse transitions and animations. Automated accessibility runs cover light, dark, and system themes after animations settle; visual snapshots check clipped text, overlap, and horizontal overflow.
