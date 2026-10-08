# LinkedIn guidance

LinkedIn text styling is faux formatting: Unicode letters and combining marks survive copy/paste because LinkedIn receives them as plain text.

Use styled text sparingly:

- Best uses: one hook, a short subheading, one metric, or a brief before/after phrase.
- Keep profile keywords, hashtags, handles, URLs, and discoverable terms plain because look-alike characters are different code points and may not match search.
- Screen readers may announce styled characters individually or poorly. A fully styled paragraph is both harder to read and less accessible.
- Rendering varies by device, font, and app version. Decorative script, Fraktur, enclosed characters, and combining marks carry more risk than bold sans.
- Some supplementary-plane characters can consume more UTF-16 code units than ordinary letters. Avoid promising that visual length equals LinkedIn's counter.

When asked to “make it pop” without a precise direction, bold only the first short line, leave the body plain, use whitespace for structure, and avoid decorative alphabets.
