# Outfit Render Contract

Apply this contract before every outfit generation, regeneration, clothing edit, footwear edit, accessory edit, or repair. The enforcement order is:

1. Canonical-image preservation
2. Identity preservation
3. Edit-scope preservation
4. Wardrobe fidelity
5. Pose and camera preservation
6. Output cardinality
7. Styling quality

If constraints 1–6 cannot be verified after generation, return a controlled failure. Styling quality never justifies weakening them.

## Mandatory edit-first rule

When a valid real body reference exists, perform outfit visualization as a localized edit of that exact image. Never intentionally recreate, restage, or substitute the person. The selected real reference is the required visual base.

Modify only the explicitly requested garment or accessory regions. Prefer an image editor with an explicit mask. If no mask input is exposed but the tool can edit from the real base, proceed with a narrowly scoped logical garment mask and verify the result afterward. Return `OUTFIT_LOCAL_EDIT_UNAVAILABLE` only when no available image path can accept the real base as an edit/reference input; lack of explicit-mask support alone is not a blocker.

## Garment-only mask policy

Select the smallest region that fully contains each requested garment replacement:

- include the garment interior plus only the seam or occlusion margin required at collars, shoulders, cuffs, waistlines, hems, and footwear contact points;
- exclude the face, hair, ears, neck, exposed chest or skin, hands, visible legs, and feet unless that exact clothing category necessarily covers them;
- exclude the background and all inherited items outside the requested categories;
- never use a full-person, full-head, or full-image mask for an ordinary clothing change;
- create separate masks or logical regions for disjoint garments when the tool allows it.

Set `mask_mode: explicit` when a real mask is supplied to the editor. Set `mask_mode: logical_localized` when the host exposes only reference-image editing; in that mode, put the precise target and protected-region list into both the manifest and the edit instruction. The verifier must know which mode was used.

## Protected-region invariant

Everything outside the explicit mask or declared logical garment regions is protected. Unless the user explicitly requests an allowed change, protected regions include:

- face, head, hair, hairline, ears, neck, expression, and exposed skin;
- arms, hands, visible legs, feet, stance, limb placement, body geometry, and pose;
- existing footwear and accessories outside the requested categories;
- background, furniture, floor, shadows, lighting, camera geometry, framing, crop, and perspective.

Exclude protected regions from the edit scope. In `explicit` mode, require protected pixels to remain unchanged wherever the editor honors the mask. In `logical_localized` mode, require strong visual identity, pose, and scene preservation and reject any observable drift; do not falsely claim pixel-level equality. The face is never a requested edit region for clothing-only changes.

## No automatic outfit completion

Never invent a missing Wardrobe category. Ordinary requests such as `generate an outfit from my wardrobe` do not mean `create a complete fashion look` and do not authorize footwear, accessories, layers, or presentation styling that the user did not select.

If shirt and trousers are selected but footwear is not requested for replacement, preserve the exact existing footwear from the selected real base. Apply the same rule to belts, watches, jewelry, hats, jackets, bags, eyewear, socks, undershirts, and other visible items.

If the user explicitly requests replacement of a category or a complete Wardrobe-only look and an explicitly required category has no approved item, stop before generation with `WARDROBE_CATEGORY_MISSING`. Name the missing category and ask the user to add/select an item or explicitly keep the inherited base item.

## Base-item inheritance

Visible items already present outside the requested edit scope are `inherited_base_items`, not newly introduced Wardrobe Items. They may remain unchanged even when absent from the Wardrobe. Never replace an inherited base item with a different non-Wardrobe item.

Wardrobe-only rules apply to items newly introduced or replaced. Preservation rules apply to inherited base items outside the edit scope.

## Render manifest

Before calling an image tool, resolve the request into an immutable manifest:

```yaml
render_manifest:
  manifest_id: string
  parent_manifest_id: string | null
  attempt: integer
  profile_id: string
  base_reference_id: string
  base_view: front | side | back | three_quarter
  view_selection_reason: explicit | default_front_only | automatic_available_view
  operation_mode: localized_edit
  mask_mode: explicit | logical_localized
  requested_changes:
    - category: string
      wardrobe_item_id: string
      target_region: string
  inherited_base_items:
    - category: string
      description: string
      action: preserve_exact
  protected_regions: [string]
  forbidden_additions: [string]
  approved_edit_masks: [string]
  logical_edit_regions: [string]
  excluded_candidate_ids: [string]
  output:
    image_count: 1
    panel_count: 1
    person_count: 1
    view_count: 1
    view: front | side | back | three_quarter
    collage: false
    text_overlay: false
  capability_gate:
    real_base_edit_supported: boolean
    explicit_masks_supported: boolean
    logical_localized_edit_supported: boolean
    protected_regions_enforceable: boolean
    failed_candidates_excludable: boolean
    output_cardinality_enforceable: boolean
```

Pass the manifest to generation and verification. Do not infer allowed additions after generation. Keep each manifest immutable. For a retry, create a derived manifest with a new ID, incremented attempt, the previous manifest as parent, and every quarantined candidate added to `excluded_candidate_ids`.

## Capability gate

Require `real_base_edit_supported`, `failed_candidates_excludable`, `output_cardinality_enforceable`, and either `explicit_masks_supported` or `logical_localized_edit_supported`. `explicit_masks_supported: false` is acceptable when `logical_localized_edit_supported: true`; it must not cause a pre-generation refusal. The execution path must use the selected real reference, selected Wardrobe Items, clean Face References, and requested single view. Verification decides whether protected regions were preserved.

## Per-view cardinality lock

When the user explicitly requests one or more views, use exactly the requested views that have matching approved real references. When no view is requested, automatically select `front`, `side`, and `back` from the profile's approved real references; a `front_only` profile therefore selects only `front`, while a complete `multi_view` profile selects all three. Do not auto-select `three_quarter` unless the user requests all available reference views.

Create a separate manifest and separate image for each selected view. Each image must contain exactly one panel, one person, and one view. Forbid grids, contact sheets, triptychs, before/after panels, detail panels, duplicate people, text overlays, and secondary angles within an image. Do not combine the automatically selected views into a collage unless the user explicitly requests a collage.

## Literal try-on output

Do not reinterpret ordinary outfit requests as fashion shoots, editorials, lookbooks, catalog cards, styled compositions, or presentation graphics. The default output is a literal localized wardrobe try-on on the selected real reference.

## Failed-candidate quarantine

Every failed candidate is quarantined. It must never become a body, face, identity, or pose reference; influence allowed views; or be reused as the source for identity, pose, camera, framing, body, background, or unauthorized-item repair.

For those failures, rebuild the complete input set from only the selected real body reference, clean Face References, selected approved Wardrobe Item images, and the manifest. Explicitly exclude every failed candidate.

The only exception is a verifier-classified `LOCAL_ARTIFACT`: an otherwise identity-, pose-, view-, and Wardrobe-compliant candidate may receive one tightly masked local repair. It remains quarantined until the repaired candidate passes the full verifier.
