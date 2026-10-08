# UI and Localization Bugs

## Inspect first

- view ownership
- presenter or binding layer
- listener registration
- localization table and locale
- navigation
- layout and scaling
- destroyed or hidden views

## Common causes

- duplicate listeners
- stale view model
- hardcoded string bypassing localization
- wrong locale event lifetime
- layout rebuild timing
- missing focus target
- hidden view still subscribed

## Validation

- open and close repeatedly
- locale switching
- resolution changes
- keyboard and controller navigation
- scene reload
