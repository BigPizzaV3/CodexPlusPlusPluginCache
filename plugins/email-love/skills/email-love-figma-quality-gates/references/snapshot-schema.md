# Audit snapshot schema

## Contents

- Example snapshot
- Batch fields
- Module fields

The validator accepts one JSON object with `batch` and `modules`. Keep measurements numeric
and in email pixels.

## Example

```json
{
  "batch": {
    "name": "Proof batch 01",
    "phase": "proof",
    "emailWidth": 600,
    "contentWidth": 520,
    "mobileViewports": [320, 375, 390],
    "riskClassesPresent": ["grouped-icon-text"],
    "proofRisksCovered": ["grouped-icon-text"],
    "proofBatchAccepted": false,
    "statusClaim": "canvas and structure ready, exporter verification deferred",
    "exporter": {
      "desktop": "deferred",
      "mobile": "deferred"
    }
  },
  "modules": [
    {
      "id": "12:34",
      "name": "Benefits, image top + icon rows",
      "sourceRef": "Source screenshot 03 / benefits band",
      "sourceParity": {
        "content": true,
        "order": true,
        "crop": true,
        "type": true,
        "color": true,
        "spacing": true,
        "desktop": true,
        "mobileIntent": true
      },
      "structure": {
        "rootTag": "mj-wrapper",
        "nodeType": "",
        "directPageChild": true,
        "untaggedFrameCount": 0,
        "unknownTagCount": 0,
        "incompleteLeafPairCount": 0,
        "unequalAxisCount": 0,
        "axisExceptions": [],
        "unintendedFixedHeightCount": 0
      },
      "census": {"images": 1, "groups": 1, "properties": 2},
      "images": [
        {
          "name": "Feature icon / sparkle",
          "role": "icon",
          "meaningful": true,
          "fillType": "IMAGE",
          "imageHash": "abc123",
          "scaleMode": "FILL",
          "rectWidth": 32,
          "rectHeight": 32,
          "assetWidth": 64,
          "assetHeight": 64,
          "cropApproved": false,
          "altText": "Odor filtration"
        }
      ],
      "groups": [
        {
          "name": "Feature row 1",
          "width": 520,
          "mobileSectionPaddingLeft": 40,
          "mobileSectionPaddingRight": 40,
          "columns": [
            {
              "name": "Icon column",
              "width": 96,
              "paddingLeft": 0,
              "paddingRight": 10,
              "content": {
                "kind": "image",
                "naturalWidth": 32
              }
            },
            {
              "name": "Text column",
              "width": 424,
              "paddingLeft": 16,
              "paddingRight": 0,
              "content": {
                "kind": "text",
                "longestUnbreakablePx": 90
              }
            }
          ]
        }
      ],
      "properties": [
        {
          "name": "Headline",
          "type": "TEXT",
          "evidence": "Changes between campaigns",
          "bindingCount": 1,
          "boilerplate": false,
          "linkBearing": false
        },
        {
          "name": "Show Feature Row 3",
          "type": "BOOLEAN",
          "evidence": "Source family includes a two-row version",
          "bindingCount": 1,
          "hideScope": "complete-region",
          "remainingLayoutComplete": true,
          "ancestorRequiredFixedColumn": false
        }
      ]
    }
  ]
}
```

## Batch fields

- `phase`: `proof` or `normal`.
- `mobileViewports`: target widths used for every group ledger.
- `riskClassesPresent`: any of `photo-crop`, `grouped-icon-text`,
  `multi-column-properties`, and `footer-social` found in the source inventory.
- `proofRisksCovered`: risk classes represented by the chosen proof modules.
- `proofBatchAccepted`: required and `true` for a normal batch.
- `statusClaim`: one of the four states defined by the skill.
- `exporter.desktop` and `exporter.mobile`: `pass`, `fail`, or `deferred`.

A proof batch has at most four modules. A `complete` claim requires desktop and mobile
`pass`. A normal batch cannot validate until the proof batch is accepted.

## Module fields

- `sourceRef` identifies an exact source screenshot, email, or frame region.
- `sourceParity` contains every comparison dimension shown above.
- `structure` contains measured counts, not checklist prose.
- `structure.axisExceptions` lists documented render-contract exceptions for unequal
  auto-layout axes, one `{"node", "reason"}` object each; the only allowed reason today is
  `top-aligned-multi-column`. `unequalAxisCount` may not exceed the number of valid
  exceptions.
- `census` is the independently measured node census: how many meaningful images, groups,
  and properties the module's node tree actually contains. Each inventory array must match
  its census count, so an empty array cannot conceal real content. The `images`, `groups`,
  and `properties` arrays are REQUIRED even when audited empty; omitting one is absent
  evidence and fails validation. A measurement recorded as anything other than a finite
  number (an "unknown" string, null, a negative) also fails; the validator never substitutes
  zero.
- `images` contains one record per meaningful image, icon, or social mark.
- `groups` contains every `mj-group` that must remain side by side on mobile.
  A fixed bordered group whose columns deliberately sum short of the outer width declares
  the gap as `borderHeadroom` (px) with a `headroomReason`; an undeclared gap fails.
- `properties` contains every component property, including fixed TEXT and zero BOOLEAN cases.

`longestUnbreakablePx` must be measured against the exported font stack, not the Figma canvas
font. `naturalWidth` is the minimum rendered width an image needs to remain unshrunk; it is
not automatically the source file's pixel width when a 2x asset is intentionally displayed
at half size.
