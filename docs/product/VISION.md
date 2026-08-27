# Vision

## Vision statement

Turn scattered, anecdotal knowledge about stray dogs in Creel into a shared,
trustworthy, map-based picture that the Asociación de Hoteles de Chihuahua can act
on — while keeping reporting frictionless and anonymous for anyone who wants to
help.

## What success looks like

- A tourist or resident can report a sighting in **under 5 minutes**, with no
  account and no training (RNF04).
- The public map gives an at-a-glance sense of where dog presence and incidents
  concentrate.
- The Association can see detailed, filterable data and export it to inform
  strategy and to share with authorities.
- The data is trustworthy enough to base decisions on — meaning fake, duplicate,
  and low-quality reports are kept under control without adding friction for honest
  reporters.

## Design principles

1. **Photo-first.** The photo is the core evidence of a report. The app opens on
   the camera (RF07). Everything is built around making a quick, verified visual
   report.
2. **Anonymous by default.** No personal data from the public (RNF13). Trust is
   established through technical signals (photo validation, geofencing, device
   fingerprinting, confidence scoring), not identity.
3. **Offline-first.** People report in the field, where connectivity is unreliable.
   Reports must be creatable offline and sync later (RNF12).
4. **Honest about limits.** The prototype does not over-promise. It does not claim
   to identify individual dogs; it helps humans make better judgments. Heavy ML is
   explicitly deferred (RNF35).
5. **Human-in-the-loop for hard calls.** The system suggests (possible duplicates,
   flagged reports); a human administrator decides.

## Non-goals (for now)

- Individual dog identification / re-identification.
- Multi-city or multi-organization scaling.
- Commercial/tiered access.
- Species beyond dogs.
