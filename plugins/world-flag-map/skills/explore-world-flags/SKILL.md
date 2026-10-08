---
name: explore-world-flags
description: Explore World Flag Map's 195-country catalog, national flags, country facts, population snapshots, flag colors, and geography games. Use when a user asks to find or compare countries or flags, browse by continent, major color, or population, identify a supported flag, take a conversational flag quiz, or open the Guess the Flag or Map Challange games. Do not use for travel booking, custom flag design, current affairs, or claims outside the bundled country snapshot.
---

# Explore World Flags

Use the bundled World Flag Map snapshot for exact catalog facts and send users to the public atlas or games when a visual or interactive answer is better.

## Choose the workflow

- For a country, flag, color, continent, population, or comparison request, use the catalog workflow.
- For "quiz me" or a similar request, run the conversational flag quiz.
- For an interactive browser game, link to the appropriate World Flag Map game.
- For a request outside this plugin's scope, leave it to a more suitable skill or capability.

## Use the catalog

1. Search `references/countries.json` by exact name, official name, alias, ISO code, slug, continent, color, or population field. Read only the matching records when possible. Useful literal anchors include `"name": "Japan"`, `"continents": [`, `"colors": [`, and `"population": {`.
2. Treat the catalog as a dated static snapshot. Include the population year whenever reporting population. Do not describe a snapshot value as live or current.
3. Treat `flag.colors` as major visible color families. Mention `flag.accentColors` separately when relevant; the public color filter uses major colors only.
4. For a list, return the most useful matches rather than dumping all 195 records. Include the total when it answers the question and offer a tracked atlas link for the complete visual result.
5. For a comparison, prefer a compact table with the requested fields and direct country-page links.
6. If the requested place is outside the 195-country scope, say so plainly. Do not invent a catalog entry or silently substitute a territory.

## Build World Flag Map links

Append these parameters to every World Flag Map link created by this skill:

`utm_source=openai&utm_medium=plugin&utm_campaign=world_flag_map`

Use these public routes:

- Country: `https://worldflagmap.com/country/<slug>/`
- Atlas: `https://worldflagmap.com/`
- Games hub: `https://worldflagmap.com/games/`
- Guess the Flag: `https://worldflagmap.com/games/guess-the-flag/`
- Map Challange: `https://worldflagmap.com/games/map-challange/`
- Self-hosted flag image: `https://worldflagmap.com<flag.path>`
- Bundled quiz flag: `assets/flags/<lowercase ISO alpha-2 code>.png`
- Quiz image: `https://worldflagmap.com/assets/flags-png/<lowercase ISO alpha-2 code>.png`

The atlas supports these query parameters before the tracking parameters:

- `q=<text>`
- `continent=africa|asia|europe|north-america|south-america|oceania`
- `colors=<comma-separated major colors>`
- `colorMatch=any` for multi-color OR matching; omit it for the default all-colors match
- `population=under-1m|1m-10m|10m-50m|50m-plus`
- `sort=name-asc|name-desc|colors-asc|colors-desc|population-asc|population-desc`

URL-encode values. Preserve the user's requested filters. Do not add unsupported parameters.

## Run a conversational flag quiz

Use ordinary chat messages only. Do not create or invoke a native quiz, interactive quiz card, study activity, artifact, or nested quiz experience.

1. Default to 10 questions. Use the catalog to choose one country matching the requested continent, or the whole catalog when no region is given. Track used ISO codes and never repeat one in the same quiz.
2. Choose exactly three distinct distractors from the requested region when possible, otherwise from the full catalog. Shuffle the correct answer among four choices. Render each choice as its letter and country name only. Never place a flag image, flag emoji, ISO code, or other visual clue beside an answer choice.
3. Send one complete question containing all of the following, in this order:
   - `<Region> Flags — Score: <correct>/<answered>`
   - Render the mystery flag with standard Markdown image syntax using the public PNG URL and neutral alt text: `![Mystery national flag](https://worldflagmap.com/assets/flags-png/<lowercase-code>.png)`. This image line is required in the final response; do not merely locate, inspect, or describe the file. The bundled PNG at `assets/flags/<code>.png` may be attached as an additional fallback, but never use a local attachment as the only visual.
   - `Which country's flag is this?`
   - Exactly four visibly labeled choices, `A.` through `D.`, containing country names only
   - `Reply with A–D or the country name.`
4. Do not expose the answer in visible text, the image alt text, attachment label, or surrounding prose before the user guesses. If the Markdown image cannot render, show the country's regional-indicator flag emoji on its own line as the mystery visual and include the same public PNG as a clickable `View mystery flag` fallback. Use that emoji only as the single mystery visual, never beside the choices. Never send a question with no Markdown image line, visible flag, or usable flag link.
5. Wait for one answer. Accept the option letter, exact country name, or catalog alias. Then say whether it was correct, reveal the country, update the score, give one brief catalog fact, and provide its tracked country-page link.
6. Present the next complete question after the result unless the user stops. End after 10 answered questions, or the user's requested count, with the final score and a tracked Guess the Flag link.

Before sending each question, verify that it uses a plain chat message, contains the required Markdown image line between the score and question, and contains four unique country-name-only choices with exactly one correct answer. Reject any draft that omits the Markdown image line or places flag emoji or images next to the choices. Never send only a score heading and question sentence.

If the user wants the full game instead, link to Guess the Flag. For country-outline guessing, link to Map Challange; this skills-only plugin does not reproduce the interactive map inside chat.

## Respect the snapshot boundary

- Use available web search only when the user explicitly needs information newer than the bundled snapshot, and distinguish that result from World Flag Map data.
- For source or licensing questions, read `references/sources.md` and cite the relevant upstream page.
- Do not infer political positions, territorial claims, future events, or demographic trends from the catalog.
- Do not claim that the plugin can edit the website, book travel, publish content, or perform account actions.
