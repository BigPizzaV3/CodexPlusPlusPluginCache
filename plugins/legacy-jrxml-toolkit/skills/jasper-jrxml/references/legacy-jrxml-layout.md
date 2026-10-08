# Complex legacy JRXML layout reference

This reference targets dense official forms built with iReport/JasperReports 2.x, especially JasperReports 2.0.4 and the old `//JasperReports//DTD Report Design//EN` format.

## 1. Start from a compatible model

Clone the nearest report already compiling in the consuming project. Preserve its XML header, DTD, page geometry, common parameters/fields, styles, groups, shared subreports, footer, and verbose formatting. Rewrite only report-specific sections.

Do not copy a modern JasperReports sample into a 2.x document. A compatible project model is the source of truth.

## 2. Coordinate system

A common A4 portrait legacy layout uses:

```xml
pageWidth="595"
pageHeight="842"
leftMargin="30"
rightMargin="30"
topMargin="10"
bottomMargin="0"
columnWidth="535"
```

This yields a drawing width near `x=0..534`. Treat these values as an example; preserve the chosen model's actual geometry.

- Dense-form fonts are commonly Helvetica 6–8 pt; subsection headings may use Helvetica Bold 9 pt.
- Use one group/header band per logical section when that matches the project model.
- Elements use absolute `x/y/width/height` positions inside fixed-height bands.
- Group order determines vertical report order.
- System bands often remain at height zero except a project-specific footer.
- A rotated gray sidebar may occupy a narrow left strip, while content begins immediately to its right.

## 3. Building blocks

Syntax varies slightly across old releases and DTDs. Copy the exact element/attribute ordering from a compiling project model.

### Rounded field container

```xml
<rectangle radius="3">
  <reportElement
    x="25"
    y="22"
    width="190"
    height="34"
    key="field-container-31"/>
  <graphicElement
    stretchType="NoStretch"
    pen="Thin"/>
</rectangle>
```

### Opaque numbered box

Numbered boxes in dense forms are often about 13×14 px and align with the container's upper-left corner:

```xml
<staticText>
  <reportElement
    mode="Opaque"
    x="25"
    y="22"
    width="13"
    height="14"
    key="field-number-31"/>
  <box
    topBorder="Thin"
    topBorderColor="#000000"
    leftBorder="Thin"
    leftBorderColor="#000000"
    rightBorder="Thin"
    rightBorderColor="#000000"
    bottomBorder="Thin"
    bottomBorderColor="#000000"/>
  <textElement
    textAlignment="Center"
    verticalAlignment="Middle">
    <font size="8"/>
  </textElement>
  <text><![CDATA[31]]></text>
</staticText>
```

### Rotated gray section label

```xml
<staticText>
  <reportElement
    mode="Opaque"
    x="1"
    y="2"
    width="22"
    height="168"
    backcolor="#CCCCCC"
    key="section-sidebar"/>
  <box
    topBorder="Thin"
    topBorderColor="#000000"
    leftBorder="Thin"
    leftBorderColor="#000000"
    rightBorder="Thin"
    rightBorderColor="#000000"
    bottomBorder="Thin"
    bottomBorderColor="#000000"/>
  <textElement
    textAlignment="Center"
    verticalAlignment="Middle"
    rotation="Left">
    <font size="7"/>
  </textElement>
  <text><![CDATA[Section label]]></text>
</staticText>
```

### Boxed response value

```xml
<textField
  isStretchWithOverflow="false"
  isBlankWhenNull="true"
  evaluationTime="Now">
  <reportElement
    x="178"
    y="75"
    width="12"
    height="11"
    key="response-31"/>
  <box
    topBorder="Thin"
    topBorderColor="#000000"
    leftBorder="Thin"
    leftBorderColor="#000000"
    rightBorder="Thin"
    rightBorderColor="#000000"
    bottomBorder="Thin"
    bottomBorderColor="#000000"/>
  <textElement textAlignment="Center">
    <font size="7"/>
  </textElement>
  <textFieldExpression class="java.lang.String"><![CDATA[$F{responseCode}]]></textFieldExpression>
</textField>
```

Dates can be rendered as a legible `dd/MM/yyyy` text box. Decorative per-character dividers may be omitted only when the user accepts that fidelity tradeoff.

## 4. Key technique: rounded rectangle without a top border

Many official forms use rounded boxes whose upper border is visually open beneath a title. Legacy `<box>`/`pen` cannot combine rounded corners with only three visible sides.

Draw the full rounded rectangle, then cover only its top border with a slightly narrower opaque white rectangle with no pen:

```xml
<rectangle radius="3">
  <reportElement
    x="148"
    y="194"
    width="385"
    height="14"
    key="open-container"/>
  <graphicElement
    stretchType="NoStretch"
    pen="Thin"/>
</rectangle>

<rectangle>
  <reportElement
    mode="Opaque"
    x="150"
    y="192"
    width="381"
    height="4"
    backcolor="#FFFFFF"
    key="open-container-cover"/>
  <graphicElement
    stretchType="NoStretch"
    pen="None"/>
</rectangle>
```

Important details:

- The covering rectangle has `pen="None"` and an opaque white background.
- It overlaps the top line by a few pixels.
- It is roughly two pixels narrower on each side so it does not erase the rounded corners.
- Element order matters: the cover must render after the outlined rectangle and before labels that need to remain visible.
- The same method can erase selected internal divider segments beneath long labels.

## 5. Header and shared blocks

Clone the title/header structure from the compatible model. Dense forms often combine organization text, a prominent system title, form title, identifier box, and a thick rounded classification/status box.

If the project supplies common header or general-data subreports, reuse them. Declare their parameters with the exact legacy types and preserve their established subreport/data-source expressions. Do not recreate a shared header unless explicitly required.

## 6. Writing style

- Use verbose multiline XML with one attribute per line.
- Keep explicit border values and colors, including borders set to `None`, when that matches the model.
- Assign a unique `key` to every element.
- Declare every field referenced by `$F{}` and every parameter referenced by `$P{}`.
- Preserve the model's element order; overlays and white cover rectangles rely on it.
- Avoid automatic XML formatting that changes DTD-era ordering or iReport conventions.

## 7. Common failures and prevention

1. **Closed top border:** the white cover rectangle is missing, too narrow, ordered incorrectly, or not opaque.
2. **Misaligned rectangles:** containers were guessed from a full-page screenshot. Derive proportions from sharp section-level captures and align numbered boxes first.
3. **Compact unreadable JRXML:** rewrite additions in the model's verbose format for review and iReport compatibility.
4. **Implicit border behavior:** set all four borders and their colors explicitly where the model does.
5. **Empty fields:** expression name differs from the runtime data key, or the declared Java type differs from the supplied value.
6. **Layout validates but clips:** band height is smaller than its lowest element, elements overlap, or stretch behavior differs from the model.
7. **Modern syntax inserted:** an online sample came from a newer JasperReports release. Revert to syntax proven by the project's 2.x compiler.

## 8. Source images and PDFs

Request:

- one complete view of every page;
- sharp zoomed captures of every logical section;
- the original PDF when available;
- known measurements/proportions and page order;
- clarification for text or domains that remain unreadable.

Render PDFs locally when tools are available, but do not assume a rasterizer exists. Several clear section captures are more reliable than a single compressed full-page screenshot.

## 9. Recommended workflow

1. Inventory pages, sections, field numbers, labels, domains, boxes, dividers, and checkboxes.
2. Identify the exact legacy version and nearest compiling model.
3. Map the data contract for every field and parameter.
4. Map coordinates per section within the model's page geometry.
5. Clone the model and preserve common declarations/subreports.
6. Rewrite the report-specific section using the building blocks above.
7. Compile after each meaningful change.
8. Fill the report through the real application with representative data.
9. Compare side by side with the authoritative form and iterate geometry.
10. Record confirmed project-specific corrections under `docs/report/`.

## 10. Fidelity checklist

- [ ] Every page and section from the authoritative form exists.
- [ ] Every rectangle, divider, checkbox, domain label, and numbered field exists.
- [ ] Rounded open-top containers use a correctly ordered white cover rectangle.
- [ ] Number boxes align with their field containers.
- [ ] Rotated section bars match the source.
- [ ] Shared headers/subreports are reused where required.
- [ ] Every `$F{}` and `$P{}` is declared and matches the runtime contract exactly.
- [ ] Band heights contain all elements without clipping.
- [ ] Footer and page numbering match the source/model requirements.
- [ ] The report compiles with the exact JasperReports 2.x dependency set.
- [ ] The application-generated PDF was compared against every page of the source.
