# Command Reference

Accept key-value arguments, short natural language, or a mixture of both. Apply the internal workflows in `SKILL.md` automatically.

## `/create-fashion-profile`

Create, validate, persist, and activate a profile.

```text
/create-fashion-profile
name: Ahmed
front_image: [upload]
side_image: [upload]
back_image: [upload]
face_image_1: [upload]
face_image_2: [upload]
```

Front-only profiles are valid:

```text
/create-fashion-profile
name: Ahmed
reference_mode: front_only
front_image: [upload]
face_image_1: [upload]
face_image_2: [upload]
```

Infer `front_only` when the user supplies only a front full-body image or explicitly says to use only it. Do not request side or back images in that case.

Do not ask for gender during profile creation. For later compliments, use an address form only when the user volunteers it or uses unambiguous self-referential wording; otherwise stay neutral. Never infer it from profile photos or the display name.

Internal workflow:

1. Confirm all images belong to the intended person.
2. Run the Reference Quality Check on every image and verify each real body reference's exact view.
3. Enforce zero eyewear on the Canonical Mockup and all primary Face References.
4. Reject any glasses-wearing image for a primary role and request an eyewear-free replacement.
5. Validate full-body coverage and face visibility.
6. Persist durable image references.
7. Set the valid front image as Canonical Mockup and `pose_lock_reference_id`.
8. Set `allowed_generation_views` only from real body references that passed validation, and map each allowed view to its exact pose-lock reference.
9. Set `automatic_generation_views` to the available approved subset of `front`, `side`, and `back`, in that order. For `front_only`, set both view lists to `[front]`, set `default_generation_view: front`, and lock the canonical pose and camera.
10. Create and activate the profile.

Do not finish profile creation as `ready_for_eyewear_try_on` unless the Canonical Mockup and at least one primary Face Reference are verified eyewear-free; prefer both primary Face References.

### Required response after uploads

Always return a guided handoff after processing the images. Include:

- `Profile status`: created, updated, or replacement required;
- accepted references, `reference_mode`, and available views;
- readiness for outfit generation and eyewear try-on;
- `Next actions`: two to four simple natural-language suggestions appropriate to the current state.

If the profile is ready and the Wardrobe is empty, the primary next action is to upload clothing product photos or links for approval. Then suggest creating an outfit after those items are approved. For a front-only profile, say front-facing generation is ready and describe side/back photos as optional only. If a reference failed, make its exact replacement the primary action and do not imply generation is ready.

Example handoff in Egyptian Arabic:

```text
تم إنشاء البروفايل بنجاح. الصورة الأمامية هي المرجع الأساسي، والتوليد الأمامي جاهز. تجربة النظارات جاهزة لأن صور الوجه من غير نظارة.

الخطوة التالية:
- ارفع صور أو روابط الملابس اللي عاوز تضيفها للدولاب.
- بعد اعتمادها قل: "اعمل طقم باستخدام الملابس دي".
- لو عاوز صور جانبية بعدين، ارفع صورة جانبية حقيقية؛ ده اختياري.
```

## `/update-fashion-profile`

Replace or add references and preferences. Re-run validation whenever a primary image changes.

```text
/update-fashion-profile Ahmed
face_image_2: [upload]
```

Compliment preferences may be updated when the user volunteers them:

```text
/update-fashion-profile Ahmed
compliment_address_form: masculine
preferred_language: ar-EG
```

Never replace a clean primary reference with a glasses-wearing image.

Adding a real side, back, or three-quarter body reference expands `allowed_generation_views` only after that exact image passes validation. Removing or invalidating a reference immediately removes its view from the allowed list. A generated image never expands the list.

## `/switch-fashion-profile`

```text
/switch-fashion-profile Ahmed
```

Load only that profile's references, wardrobe, preferences, and history.

## `/profile`

Show active profile status, including:

- body and face reference readiness;
- Canonical Mockup;
- reference mode, available generation views, default view, and active pose/camera lock;
- eyewear-free validation for each primary reference;
- `ready_for_eyewear_try_on` status;
- wardrobe and outfit counts.

Finish with state-aware next actions using the same guided-handoff rules. Never return a status dead end.

## `/import-items`

```text
/import-items
store: Example Store
source:
- favorites
- cart
- orders
```

Try an available read-only connector first, then product URLs, then uploaded product images. Imported items remain unapproved until added to the Wardrobe.

## `/add-to-wardrobe`

```text
/add-to-wardrobe
items: 1, 2, 5
```

Or:

```text
/add-to-wardrobe all
```

For eyewear, retain a clear front product image and record lens transparency or tint when reliably available.

## `/remove-from-wardrobe`

```text
/remove-from-wardrobe item_17
```

Do not delete historical outfit records; mark the association unavailable when needed.

## `/wardrobe`

```text
/wardrobe category=accessories
/wardrobe category=eyewear
/wardrobe color=black
```

## Generated-look response rule

Stage every generated or edited image privately and run `$fashion-output-verifier` before attaching, rendering, saving, ranking, or complimenting it. Only a verifier `PASS` may reach the user. For `REPAIR`, apply the smallest safe correction and reverify; allow at most three repair cycles. For `FAIL`, withhold the candidate and return `OUTPUT_VERIFICATION_FAILED` with concise reasons.

Apply the post-generation compliment rule in `SKILL.md` only after the verifier accepts the first outfit, then only after a material outfit change. Do not repeat it for same-look regenerations, localized fixes, pose or fit adjustments, or accessory-only changes such as eyewear. Add at most one compliment per response, match the user's current language and explicit address form, and mention color only when reliable. Do not add one to failures or text-only fallbacks.

## Render preflight for outfit commands

Before `/create-outfit`, `/random-outfit`, `/regenerate-outfit`, or a clothing/accessory `/fix-outfit`:

1. Read `RENDER_CONTRACT.md` and resolve the user's literal requested changes.
2. Build and persist an immutable `render_manifest` before invoking an image tool.
3. Mark visible unrequested base items as inherited and `preserve_exact`, even when they are not Wardrobe Items.
4. List every category that may be newly introduced or replaced; require an approved Wardrobe Item for each.
5. Build the smallest garment-only mask for the requested regions. Exclude face, hair, neck, exposed skin, limbs, hands, feet, pose, camera, background, and inherited items. If the editor exposes no explicit mask input, record the same boundaries as `logical_edit_regions` and set `mask_mode: logical_localized`.
6. Run the capability gate. Proceed when the real base can be edited and either an explicit mask or logical localized edit is supported. Never refuse solely because an explicit mask input is unavailable.
7. Resolve the view plan. When no view is requested, select every approved real `front`, `side`, and `back` reference in a `multi_view` profile; a `front_only` profile selects only `front`.
8. Create a separate manifest and output image for each selected view. Enforce one panel, one person, and one view inside every image.

Interpret `generate an outfit from my wardrobe` as a literal edit using the selected approved items, not permission to create a complete look, fashion shoot, lookbook, collage, new pose, or missing categories.

## `/create-outfit`

```text
/create-outfit
view: front
shirt: Green Resort Shirt
tshirt: Off-White T-Shirt
pants: Off-White Drawstring Trousers
shoes: White/Beige Sneakers
eyewear: Tortoiseshell Sunglasses
```

When `view` is omitted, use every approved real primary view in canonical order: `front`, `side`, `back`. For a complete `multi_view` profile, this produces three separate images automatically. For a partial `multi_view` profile, use only the available approved primary views. For a `front_only` profile, use `front` only. When `view` is provided, use exactly the requested approved view or views. A prior generated image never authorizes a new view or pose.

For each selected view, load that view's clean real body base and all clean Face References, validate all selected items, build a separate render manifest, and apply only its requested clothing/accessory changes. Use an explicit garment-only mask when available; otherwise use the declared logical garment regions as a strict localized-edit instruction. Preserve every inherited base item outside the edit scope, including existing footwear and watches. Enforce the identity, angle, and pose QA gates independently for every angle, then run the Fashion Output Verifier. Save, score, and render only verifier-passed revisions. A failed angle never causes another angle's failed candidate to be reused.

If the user requests a complete Wardrobe-only look and a category they explicitly want replaced has no approved item, stop with `WARDROBE_CATEGORY_MISSING`. Ask them to add/select the missing item or explicitly keep the inherited base item.

If eyewear is selected:

1. Verify `ready_for_eyewear_try_on`.
2. Start from the eyewear-free real base for the selected view, never a previous eyewear result.
3. Extract the eyewear, fit and perspective-warp it to facial landmarks, and alpha-composite only the frame and lenses.
4. Use a tiny localized generative mask only for unavoidable frame contact, occlusion, shadow, or reflection corrections.
5. Lock the eyes, eyebrows, nose, mouth, facial hair, hairstyle, hairline, expression, head, body, clothes, pose, camera, framing, and background.
6. Enforce both the eyewear identity QA gate and the angle and pose QA gate.
7. Run the Fashion Output Verifier over the complete result.
8. If any gate fails, repair and reverify within the limit or return the unchanged clean base with the applicable error; never save or render the failed edit.

## `/try-on-eyewear`

Apply one Wardrobe eyewear item without changing the outfit.

```text
/try-on-eyewear
item: Tortoiseshell Sunglasses
```

Optional explicit base:

```text
/try-on-eyewear
item: Black Optical Frame
base: outfit_27
```

When `base` contains eyewear, reconstruct the requested base clothing from its clean underlying Canonical Mockup or clean pre-eyewear revision, then apply the new eyewear. Never stack frames or paint over old lenses.

Never fall back to face generation or full-image generation when compositing or a safely localized edit is unavailable. Run the Fashion Output Verifier after the edit. Return a failure and the unchanged base when clean reference prerequisites or QA gates are not satisfied.

## `/random-outfit`

```text
/random-outfit occasion="summer dinner" count=3
```

Support locked items:

```text
/random-outfit
occasion: vacation dinner
count: 3
lock:
  eyewear: Tortoiseshell Sunglasses
```

Create intelligent combinations from the active Wardrobe only. For every combination, declare exactly which approved items replace which base regions. Preserve unselected categories from the corresponding real base; never fill them automatically. Generate and verify every combination/view pair separately; only passed images may be scored, ranked, or rendered. `count` means accepted clothing variations. If no view is requested, apply each variation to all automatically selected approved `front`, `side`, and `back` views. Keep every view in its own image and locked to its matching real reference.

## `/regenerate-outfit`

```text
/regenerate-outfit outfit_27
```

Rebuild the render inputs from the same clean real base, clean Face References, approved items, and a derived manifest. Do not pass a failed or prior generated candidate as a visual source unless the verifier classified it solely as `LOCAL_ARTIFACT` and supplied a tight repair mask or logical region. Strengthen only the violated constraints. After two repeated structural failures, allow at most one final clean-base attempt with a stricter localized instruction and reduced context. Regeneration must not introduce an alternate pose, view, camera, framing, inherited-item change, or missing category. If the outfit includes eyewear, reapply it from the clean pre-eyewear base rather than using the prior generated face. Treat the result as a new staged candidate and rerun the complete verifier checklist before rendering.

## `/fix-outfit`

```text
/fix-outfit
outfit: outfit_27
issue: The right temple arm is floating above the ear.
preserve_everything_else: true
```

Perform a localized edit only. Do not change view, pose, camera, framing, perspective, body geometry, or limb placement. If the user explicitly requests a different view, require a real verified reference for it or return `REFERENCE_VIEW_NOT_AVAILABLE`. For eyewear fixes, do not modify the eyes, eyebrows, nose shape, mouth, beard, hair, face geometry, expression, or any region outside the frame/contact area. The repaired image remains staged until the Fashion Output Verifier passes it.

## `/rank-outfits`

```text
/rank-outfits
outfits:
- outfit_27
- outfit_31
- outfit_32
```

Accept only verifier-passed revisions. Apply the scoring rubric from `SKILL.md` and include accessory fit in the Shoes and Accessories score.

## Error responses

Use concise, actionable messages:

```text
REFERENCE_REJECTED_EYEWEAR
Eyewear was detected in face_image_1. This image may be stored only as a supplemental reference. Upload a clear image of the same person without any glasses to use it as a primary Face Reference.
```

```text
EYEWEAR_TRY_ON_NOT_READY
The active profile does not yet have the required clean, eyewear-free references. Upload an eyewear-free Canonical Mockup and primary Face Reference before trying on glasses.
```

```text
IDENTITY_PRESERVATION_FAILED
The generated edit changed protected facial features, so it was not accepted or saved as the final result. The clean base image remains unchanged.
```

```text
EYEWEAR_IDENTITY_QA_FAILED
The eyewear edit could not preserve every protected facial region, so it was rejected and not saved. The clean base image remains unchanged.
```

```text
REFERENCE_VIEW_NOT_AVAILABLE
The requested view has no matching quality-approved real full-body reference. Upload that real view or continue with an available view; no new angle was synthesized.
```

```text
ANGLE_POSE_LOCK_FAILED
The generated result drifted from the selected real reference's view, pose, or camera, so it was rejected and not saved. The selected base image remains unchanged.
```

```text
OUTPUT_VERIFICATION_FAILED
The generated image did not pass the mandatory pre-render checks after the permitted repair attempts, so it was not shown or saved. The last accepted or clean base remains unchanged. Review the listed issues or try the request again.
```

```text
OUTFIT_LOCAL_EDIT_UNAVAILABLE
No available image path can accept the selected real body reference as an edit or reference-guided transformation input. A text-only replacement person was not generated.
```

```text
OUTFIT_RENDER_MODE_UNSAFE
The current image path cannot use the selected real base, enforce one requested view, or return a candidate for verification. Missing explicit-mask support alone must not produce this error.
```

```text
WARDROBE_CATEGORY_MISSING
The requested complete look requires an approved item for: {category}. Add or select that item, or explicitly keep the existing base item.
```

```text
RENDER_PIPELINE_CONSTRAINT_FAILURE
The available generation path repeatedly produced a structural failure. A final clean-base attempt may use a stricter localized instruction; if all three attempts fail, return OUTPUT_VERIFICATION_FAILED. No failed candidate is shown or reused.
```
