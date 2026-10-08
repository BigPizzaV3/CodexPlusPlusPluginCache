# World Flag Map snapshot sources

The bundled `countries.json` is a compact export of World Flag Map's checked-in catalog. It is generated at build time and is not live data.

## Country facts

- Source: [mledoze/countries](https://github.com/mledoze/countries)
- Pinned revision: `9eff32e4eef26715aa59d99b200127d1ef150e7a`
- License: [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/)

The catalog uses ISO codes, names, capitals, continents, subregions, languages, currencies, calling codes, and time zones from that snapshot, with small explicit World Flag Map overrides for display and catalog scope.

## Population

- Primary source: [World Bank Population, total (SP.POP.TOTL)](https://data.worldbank.org/indicator/SP.POP.TOTL)
- World Bank license: [Creative Commons Attribution 4.0](https://datacatalog.worldbank.org/public-licenses#cc-by)
- Vatican City fallback: [Vatican City State population statistics](https://www.vaticanstate.va/en/state-and-government/general-informations/population.html)

Every population record contains its own year and direct source URL. Report the year with the value.

## Flag classifications

- Artwork source used for analysis: [lipis/flag-icons](https://github.com/lipis/flag-icons)
- Pinned revision: `086f7e97d657358203916dbe84f61c2bccaa81eb`
- License: [MIT](https://github.com/lipis/flag-icons/blob/master/LICENSE)

World Flag Map classifies visible pixels into major and accent color families. The plugin bundles classification metadata, not the SVG artwork; flag images are served from `worldflagmap.com`.
