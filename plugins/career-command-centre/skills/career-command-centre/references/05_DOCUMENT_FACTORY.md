# Document factory

## Preconditions

Do not create a tailored application pack when the exact posting is missing, generic, closed or unverifiable. Do not create a pack for Skip unless the user explicitly overrides after seeing the risk.

A general CV base or an explicitly requested reference-format CV is not a tailored application pack. It may be created without a job posting and may be CV-only, but it must still use only the candidate's evidence and pass the same DOCX, rendering, bullet and leakage checks.

## Content contract

- Candidate identity and contact details come from supplied evidence.
- Role title, company and posting URL match the verified role dossier.
- Each substantive CV item carries evidence IDs in the structured input.
- Role-match content synthesises fit; it does not copy the job description.
- Keywords are included only when evidence supports the claim.
- Cover letter tells one coherent story rather than repeating the entire CV.
- Change log lists evidence and keywords included and excluded.

## Format

- DOCX only by default.
- ATS-safe body: no text boxes, decorative skill bars or layout tables.
- Real bullets and real hyperlinks. Use a literal U+2022 bullet in the normal body font for portable output. Do not use Word's built-in `List Bullet` style unless its active numbering definition has been verified to avoid Wingdings, Symbol and private-use glyphs. Reject U+F0B7 and other private-use numbering glyphs: browser and PDF renderers often display them as hollow boxes.
- Visible link labels, not raw URLs.
- Minimum 9 pt body text.
- Consistent hierarchy and visible section spacing.
- Experienced candidates: normally two pages with a substantially used final page.
- Early-career candidates: one strong page is acceptable.

## Required QA

1. Input contract validation.
2. Successful DOCX open.
3. Structural check: fonts, links, bullets, placeholders, comments, tracked changes and hidden text. Run `scripts/validate_docx.py`; it must inspect active numbering definitions as well as visible paragraph text. Treat any private-use glyph or Wingdings/Symbol numbering font as a failure.
4. Qualitative parseability and writing check. Run `scripts/review_cv_text.py` on the generated CV, then repair high-impact findings or document a defensible evidence-based exception. Never convert its findings into a universal ATS score.
5. Evidence-ID integrity.
6. Rendered page count and density where rendering is available. For an experienced-candidate two-page CV, require at least 65% fill on page 1 and 80% on page 2.
7. Transparent Career Centre quality rating: overall out of 10 plus evidence safety, role specificity, writing impact and document execution. State the most important remaining limitation. This is not an ATS score. Revise below 8.5/10 unless missing candidate evidence creates the honest ceiling.

## Default and custom structure

The global default is Professional Summary, Role-Match Experience, Professional Experience, Core Skills, Education, and Recognition/Certifications where evidenced. Add projects, portfolio, languages, publications or another market-relevant section only when it improves the specific application. Section labels and order are user-configurable advanced preferences; evidence rules are not.

For a reusable CV base with no target role, use Professional Summary, Career Highlights, Professional Experience, Core Skills, Education, and Recognition/Certifications where evidenced. Do not fabricate `Role-Match Experience` without a role. The same advanced section and field preferences still apply.

Advanced field preferences may change which confirmed contact fields appear, whether location or work rights are shown, whether the source headline is preserved or tailored, date display style, and section-label wording. Apply these when building the `candidate` block and section headings. Treat employer, role, date, metric, qualification and achievement edits as evidence corrections, never as styling preferences.

## Reference Word CV

When the user supplies a reference DOCX, treat it as a formatting source, not an evidence source. Reuse page geometry, font family, hierarchy, colour and spacing only where the resulting document remains openable, readable, ATS-safe and at least 9 pt. Strip body content, headers/footers containing personal data, comments, tracked changes, hidden text and metadata. Never carry facts or links from the reference person into the user's CV. Record the reference template name and any compromises in the change log.

Enter this mode only after an explicit user request. Do not offer or request a reference template during ordinary onboarding.

If the host invokes a generic document-creation capability for the physical DOCX, keep this document factory authoritative. Run `scripts/validate_docx.py` on the returned file and independently inspect the render. A self-reported “leakage check passed” or “rendered successfully” is not sufficient when the actual output contains private-use/Wingdings bullets, hollow boxes, generic sections or reference-person residue.
8. Human visual inspection of every rendered page.
9. Paired cover-letter check unless `cv_only=true`.
10. Document-version entry in the Career Passport with source-document IDs, status and change summary.
11. Run-level manifest and checksum check.

For the cover letter, the first narrative sentence must be a natural, role-specific reason or thesis. Openings beginning with “I am applying”, “I’m applying”, “I am excited to apply” or equivalent generic application language fail structural release checks. Do not approve visual QA when any bullet appears as a square, hollow box or missing glyph, even if text extraction succeeds.

Any failing required step makes the pack incomplete. Do not hide the failure behind a successful conversational summary.

Do not promise that a CV is “AI-undetectable” or optimise it to evade detection tools. Improve human credibility instead: candidate-specific evidence, natural syntax, selective detail, low repetition and a voice the candidate can comfortably defend in interview.
