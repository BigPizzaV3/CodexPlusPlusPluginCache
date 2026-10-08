# Persistent State Schema

Use stable IDs and durable storage references. Keep all records scoped by `user_id` and `profile_id`.

## Fashion Profile

```yaml
fashion_profile:
  profile_id: string
  user_id: string
  display_name: string
  active: boolean
  canonical_mockup_ref: string
  body_reference_ids: [string]
  face_reference_ids: [string]
  reference_mode: front_only | multi_view
  allowed_generation_views: [front | side | back | three_quarter]
  automatic_generation_views: [front | side | back]
  default_generation_view: front | side | back | three_quarter
  pose_lock_reference_id: string
  pose_lock_reference_ids_by_view: object
  style_preferences: object
  compliment_preferences:
    address_form: masculine | feminine | neutral
    address_form_source: explicit_preference | self_reference | neutral_fallback
    preferred_language: string | null
    preferred_dialect: string | null
  last_compliment:
    revision_id: string
    dominant_colors: [string]
    core_item_ids: [string]
    style_tags: [string]
    language: string
    address_form: masculine | feminine | neutral
    text: string
    created_at: datetime
  reference_status: incomplete | valid | replacement_required
  ready_for_outfit_generation: boolean
  ready_for_eyewear_try_on: boolean
  next_action_stage: replace_reference | add_wardrobe_items | create_outfit | try_on_eyewear
  guided_handoff_last_shown_at: datetime | null
  created_at: datetime
  updated_at: datetime
```

Treat `compliment_preferences` and `last_compliment` as optional. Never ask for gender. Set a masculine or feminine address form only from a volunteered preference or unambiguous self-referential wording in the user's own messages; otherwise store `neutral_fallback`. Never infer it from images or names. Use `last_compliment` to suppress repetition until the current accepted outfit materially changes in palette plus core garments, silhouette, layering, formality, overall style, or occasion-led direction.

Set `ready_for_eyewear_try_on` only when the Canonical Mockup and at least one primary Face Reference have `eyewear_free_verified: true`; prefer two valid Face References. Any replacement of those references must recalculate readiness.

Derive `allowed_generation_views` only from real, quality-approved full-body references. Derive `automatic_generation_views` as the available subset of `front`, `side`, and `back` in that order. A `front_only` profile must contain only `front` in both lists. Generated images and Face References never expand either list. `pose_lock_reference_ids_by_view` must map every allowed view to its exact real body reference. Keep `default_generation_view` and `pose_lock_reference_id` for single-view compatibility, but an omitted view request uses `automatic_generation_views`, not only the default.

Update `next_action_stage` whenever reference or Wardrobe readiness changes. After reference uploads or `/profile`, use it to return a concise guided handoff. It controls suggestions only and must never override prerequisites.

## Image Reference

```yaml
image_reference:
  reference_id: string
  profile_id: string
  storage_ref: string
  role: canonical_front | body_side | body_back | body_three_quarter | face_primary_1 | face_primary_2 | supplemental
  view: front | side | back | three_quarter | portrait | other
  same_person_verified: boolean
  full_body_verified: boolean
  face_visible: boolean
  eyewear_detected: boolean | uncertain
  eyewear_free_verified: boolean
  eyes_visible: boolean
  eyebrows_visible: boolean
  nose_bridge_visible: boolean
  temples_visible: boolean
  hairline_visible: boolean
  obstruction_notes: [string]
  quality_status: pass | replace | supplemental_only
  quality_reasons: [string]
  created_at: datetime
```

Never assign a primary role when `eyewear_detected` is `true` or `uncertain`, or when `eyewear_free_verified` is false.

## Wardrobe Item

```yaml
wardrobe_item:
  item_id: string
  profile_id: string
  status: imported | approved | removed
  name: string
  brand: string | null
  category: string
  subcategory: string | null
  colors: [string]
  material: string | null
  fit: string | null
  season: [string]
  product_image_refs: [string]
  product_url: string | null
  source_store: string | null
  eyewear:
    frame_type: string | null
    frame_color: string | null
    lens_type: clear | tinted | polarized | opaque | unknown | null
    lens_tint: string | null
    dimensions: object | null
  notes: string | null
```

Only `approved` items may be used for generation.

## Outfit and Revision

```yaml
outfit:
  outfit_id: string
  profile_id: string
  wardrobe_item_ids: [string]
  clean_base_reference_id: string
  clean_pre_eyewear_revision_id: string | null
  generation_view: front | side | back | three_quarter
  pose_lock_reference_id: string
  render_manifest_id: string
  current_revision_id: string
  score: number | null
  score_breakdown: object | null
  created_at: datetime

outfit_revision:
  revision_id: string
  outfit_id: string
  parent_revision_id: string | null
  image_ref: string
  edit_scope: clothing | footwear | eyewear | local_fix | full_try_on
  mask_mode: explicit | logical_localized
  approved_edit_mask_ref: string | null
  logical_edit_regions: [string]
  protected_attributes: [string]
  angle_pose_lock_passed: boolean
  identity_gate_passed: boolean
  verifier_status: pending | pass | repair_requested | failed
  render_status: staged | render_allowed | withheld
  verification_run_ids: [string]
  repair_cycle_count: integer
  candidate_status: staged | quarantined | accepted
  failure_class: LOCAL_ARTIFACT | GARMENT_FIDELITY | IDENTITY_DRIFT | POSE_DRIFT | CAMERA_DRIFT | UNAPPROVED_ITEM | COLLAGE_OR_EXTRA_VIEW | GENERATION_MODE_FAILURE | null
  structural_failure_signature: string | null
  quarantined_at: datetime | null
  qa_status: accepted | rejected | needs_fix
  qa_findings: [string]
  created_at: datetime
```

For any eyewear edit, record the clean pre-eyewear revision and accept it only when `identity_gate_passed` is true. Replacements and regenerations must branch from that clean revision, not from a glasses-wearing output. Accept every visual revision only when `angle_pose_lock_passed`, `verifier_status: pass`, and `candidate_status: accepted` are true. Render only when `render_status: render_allowed`. Quarantined generations must never become body, face, identity, or pose references; sources for structural repairs; or sources of additional allowed views.

## Render Manifest

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
  approved_edit_mask_refs: [string]
  logical_edit_regions: [string]
  excluded_candidate_ids: [string]
  output:
    image_count: integer
    panel_count: integer
    person_count: integer
    view_count: integer
    view: front | side | back | three_quarter
    collage: boolean
    text_overlay: boolean
  capability_gate:
    real_base_edit_supported: boolean
    explicit_masks_supported: boolean
    logical_localized_edit_supported: boolean
    protected_regions_enforceable: boolean
    failed_candidates_excludable: boolean
    output_cardinality_enforceable: boolean
  created_at: datetime
```

Create the initial manifest before invoking an image tool and keep each manifest immutable. For every retry, create a derived manifest with a new ID, incremented attempt, the previous manifest as parent, and updated excluded candidate IDs. Proceed when `real_base_edit_supported`, `failed_candidates_excludable`, and `output_cardinality_enforceable` are true and at least one of `explicit_masks_supported` or `logical_localized_edit_supported` is true. `protected_regions_enforceable` records whether pixel enforcement is available; when false in `logical_localized` mode, require strict post-generation visual verification instead of preflight refusal. Wardrobe-only constraints apply to newly introduced or replaced items; inherited base items outside the requested edit scope remain unchanged even when absent from the Wardrobe.

## Verification Run

```yaml
verification_run:
  verification_run_id: string
  candidate_revision_id: string
  profile_id: string
  attempt: integer
  verifier_skill: fashion-output-verifier
  body_reference_id: string
  face_reference_ids: [string]
  wardrobe_item_ids: [string]
  approved_edit_mask_ref: string | null
  mask_mode: explicit | logical_localized
  logical_edit_regions: [string]
  verdict: pass | repair | fail
  failure_class: LOCAL_ARTIFACT | GARMENT_FIDELITY | IDENTITY_DRIFT | POSE_DRIFT | CAMERA_DRIFT | UNAPPROVED_ITEM | COLLAGE_OR_EXTRA_VIEW | GENERATION_MODE_FAILURE | null
  structural_failure_signature: string | null
  retry_source: last_compliant_candidate | canonical_base | none
  identity_confidence: high | insufficient
  blocking_rule_ids: [string]
  violations:
    - rule_id: string
      severity: blocking | repairable
      region: string
      evidence: string
      repair_instruction: string | null
      permitted_mask_scope: string | null
  render_allowed: boolean
  created_at: datetime
```

Create a new immutable run for each verification attempt. A repair produces a new candidate revision and a new verification run. Quarantine every failed candidate and add it to the manifest's excluded input set for the next rebuilt attempt. Permit no more than three total generation attempts. If two consecutive attempts share the same structural failure signature, classify the second as `GENERATION_MODE_FAILURE` and allow only one final clean-base attempt with stricter locality and reduced context. If the final attempt fails, return `OUTPUT_VERIFICATION_FAILED`. `render_allowed` may be true only for `verdict: pass`; otherwise keep the candidate private and withheld.
