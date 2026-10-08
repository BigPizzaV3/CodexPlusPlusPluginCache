---
name: fashion-output-verifier
description: Independently audit Fashion Wardrobe outfit and try-on image candidates before they are rendered or saved. Use automatically after every fashion image generation, regeneration, eyewear try-on, accessory edit, or local repair to enforce identity, real-reference angle and pose locks, wardrobe fidelity, edit-scope limits, full-body coverage, and visual quality; return PASS, REPAIR, or FAIL.
---

# Fashion Output Verifier

Act as the mandatory independent pre-render QA gate for Fashion Wardrobe visuals. Review a candidate; never generate the initial outfit and never approve based on the generator's confidence.

## Required inputs

Require the staged candidate plus:

- the user request and selected approved Wardrobe Items;
- the exact real full-body base and its verified view;
- clean primary Face References;
- the pose/camera lock and allowed generation views;
- the prior accepted or clean pre-eyewear revision when applicable;
- the immutable render manifest, mask mode, explicit edit masks when available or declared logical garment regions otherwise, and quarantined candidate IDs.

If a required comparison input or visual-inspection capability is unavailable, return `FAIL` with `VERIFIER_INPUT_MISSING` or `VERIFIER_VISUAL_INSPECTION_UNAVAILABLE`. Never guess.

## Verification checklist

Evaluate independently against the render manifest:

1. **Profile isolation:** every reference and Wardrobe Item belongs to the active profile; no other identity or wardrobe appears.
2. **Identity lock:** face geometry, eyes, gaze, eyebrows, nose, mouth, jaw, ears, facial hair, hairstyle, hairline, skin, expression, head size, and head-to-body proportions match the clean references.
3. **Reference integrity:** view is allowed and backed by the selected real full-body reference; pose, stance, orientation, limb placement, camera, perspective, framing, crop, lighting, background, and body geometry remain locked.
4. **Request and wardrobe fidelity:** only requested approved items are introduced or replaced. Inherited base items remain exact. Nothing is silently substituted, omitted, invented, or added to complete the look.
5. **Edit-scope integrity:** in `explicit` mode, compare protected areas outside approved masks for unintended change. In `logical_localized` mode, compare the candidate closely with the real base and Face References and reject observable change outside declared garment regions. The face, hair, neck, exposed skin, limbs, hands, feet, pose, camera, background, and unrequested base items remain protected. Eyewear changes are limited to the frame, lenses, and tiny contact/reflection regions.
6. **Image completeness and cardinality:** enforce the manifest's exact image, panel, person, and view counts; require full-body coverage; reject collages, grids, triptychs, lookbooks, editorials, text overlays, duplicate people, extra angles, and detail panels.
7. **Visual quality:** reject broken hands, limbs, seams, hems, overlaps, floating objects, duplicate accessories, or obvious generation artifacts.
8. **Eyewear QA when applicable:** the face was not regenerated; eyes remain authentic; frame alignment, bridge contact, temples, lens symmetry, transparency, tint, reflections, and occlusion are plausible.

Treat identity changes, cross-profile content, unsupported views, pose/camera drift, observable face or full-person regeneration, edits outside the explicit or logical garment scope, missing head or shoes, any unapproved new item, changed inherited items, and unrequested panels, people, or views as blocking violations. Do not demand unavailable pixel-diff evidence in `logical_localized` mode; make the strongest visual comparison available and fail when identity confidence is insufficient.

## Machine-readable rule IDs

- `OUTFIT-R001 CANONICAL_BASE_REQUIRED`
- `OUTFIT-R002 CLOTHING_EDIT_SCOPE_ONLY`
- `OUTFIT-R003 PROTECTED_FACE_UNCHANGED`
- `OUTFIT-R004 PROTECTED_BODY_UNCHANGED`
- `OUTFIT-R005 POSE_PIXEL_LOCK`
- `OUTFIT-R006 CAMERA_AND_FRAMING_LOCK`
- `OUTFIT-R007 NO_UNAPPROVED_NEW_ITEM`
- `OUTFIT-R008 BASE_ITEM_INHERITANCE`
- `OUTFIT-R009 SINGLE_VIEW_ONLY`
- `OUTFIT-R010 NO_COLLAGE`
- `OUTFIT-R011 FAILED_CANDIDATE_QUARANTINE`
- `OUTFIT-R012 NO_AUTOMATIC_OUTFIT_COMPLETION`

## Verdict contract

Return a structured result:

```yaml
verification:
  candidate_id: string
  verdict: PASS | REPAIR | FAIL
  attempt: integer
  mask_mode: explicit | logical_localized
  identity_confidence: high | insufficient
  failure_class: LOCAL_ARTIFACT | GARMENT_FIDELITY | IDENTITY_DRIFT | POSE_DRIFT | CAMERA_DRIFT | UNAPPROVED_ITEM | COLLAGE_OR_EXTRA_VIEW | GENERATION_MODE_FAILURE | null
  structural_failure_signature: string | null
  retry_source: last_compliant_candidate | canonical_base | none
  blocking_rule_ids: [string]
  violations:
    - rule_id: string
      severity: blocking | repairable
      region: string
      evidence: string
      repair_instruction: string | null
      permitted_mask_scope: string | null
  verified_against:
    body_reference_id: string
    face_reference_ids: [string]
    wardrobe_item_ids: [string]
  render_allowed: boolean
```

- Return `PASS` only when there are no blocking violations and set `render_allowed: true`.
- Return `REPAIR` when a safe correction is possible. Give observable violations and the smallest precise repair; do not rewrite the entire prompt.
- Return `FAIL` when prerequisites are missing, a safe repair is impossible, or the maximum repair cycle is exhausted.

## Repair loop

Classify the failure before deciding to retry:

- `LOCAL_ARTIFACT`: retry from the last otherwise-compliant candidate with a tight mask.
- `GARMENT_FIDELITY`, `IDENTITY_DRIFT`, `POSE_DRIFT`, `CAMERA_DRIFT`, `UNAPPROVED_ITEM`, or `COLLAGE_OR_EXTRA_VIEW`: quarantine the candidate and retry from the clean canonical base with a rebuilt input set.
- `GENERATION_MODE_FAILURE`: rebuild from the clean base with a stricter localized instruction and reduced inputs; do not reuse the failed candidate.

For `REPAIR`, return control without rendering the candidate. Explicitly exclude quarantined candidate IDs. Review every repaired image as a new candidate and repeat the complete checklist, not only the previous defect.

Permit no more than three total generation attempts. If two consecutive candidates share the same structural blocking signature—such as collage, full-person regeneration, repeated pose/identity drift, unauthorized additions, or camera/view changes—classify the second as `GENERATION_MODE_FAILURE` and allow only one final clean-base attempt with stricter locality and reduced context. If that final attempt fails, return `FAIL` with `OUTPUT_VERIFICATION_FAILED`. Keep `render_allowed: false`; never approve a partial pass or the least-bad result.
