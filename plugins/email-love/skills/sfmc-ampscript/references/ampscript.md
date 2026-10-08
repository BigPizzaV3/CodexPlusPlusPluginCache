# AMPscript — Syntax and Function Reference

Function names and personalization strings are **case-insensitive**. Argument order is irregular — check it here rather than guessing.

## Contents

1. [Delimiters](#1-delimiters)
2. [Variables](#2-variables)
3. [Control flow](#3-control-flow)
4. [String functions](#4-string-functions)
5. [Math functions](#5-math-functions)
6. [Date and time](#6-date-and-time)
7. [Logic and utility](#7-logic-and-utility)
8. [Data Extension functions](#8-data-extension-functions)
9. [Content functions](#9-content-functions)
10. [Encoding, hashing, HTTP](#10-encoding-hashing-http)
11. [CloudPages and execution context](#11-cloudpages-and-execution-context)
12. [What AMPscript does NOT support](#12-what-ampscript-does-not-support)
13. [GTL quick reference](#13-gtl-quick-reference)

---

## 1. Delimiters

**Block — `%%[ … ]%%`.** Multiple statements. Produces **no output** at its location (except `Output()` / `OutputLine()`). Function calls inside a block do **not** carry `%%=` / `=%%`.

```
%%[
VAR @Count, @Count2
SET @Count = 0
]%%
```

**Inline — `%%=Function()=%%`.** Exactly **one** function, though nesting is allowed.

```
%%=LOWERCASE(Name)=%%
%%=LOWERCASE(SUBSTRING(Name, 1, 5))=%%
```

**Personalization strings — `%%field%%`.**

- Outside a block → **must** be wrapped: `%%fullname%%`
- Inside a block or a function → **must NOT** be wrapped: `fullname`

```
%%=UPPERCASE(%%emailaddr%%)=%%    ← INVALID
%%=UPPERCASE(emailaddr)=%%        ← VALID
```

Names with a space or special character need **square brackets**: `[First Name]`, `[Total-Expense]`.

**Tag-based equivalent:**

| Standard | Tag-based |
|---|---|
| `%%[` | `<script runat=server language=ampscript>` |
| `]%%` | `</script>` |
| `%%[]%%` | `<script runat=server language=ampscript />` |

A block must be closed in the same syntax that opened it.

**Comments:** `/* … */` only. No `//`. May span lines.

---

## 2. Variables

```
%%[VAR @Count]%%
%%[VAR @Count1, @Count2, @Count3]%%
SET @firstName = FirstName
```

Names start with `@` plus at least one other letter, number or underscore. **One variable per `SET`.**

**Declaration is not enforced.** *"The interpreter does not enforce variables to be declared."* `SET @x = 1` works without `VAR @x`, and reading a never-set variable yields empty rather than erroring. The hazard is silent typos — `%%=v(@fristName)=%%` renders blank.

**Re-declaring resets to NULL** — this is the documented idiom for clearing a variable mid-script.

**Scope is flat and global** within the rendered content. A variable set inside an `IF` is readable after `ENDIF`, and persists across separate `%%[ ]%%` blocks.

**Exception: FOR counters are locked.** *"The system locks the @Variable variable from modification within the process loop."* Declaring the counter inside the loop is a validation or runtime error.

**Outputting a variable needs `v()`:**

```
%%=v(@var1)=%%

%%[ Output(v(@text)) ]%%    ← works
%%[ Output(@text) ]%%       ← does NOT work
```

**Constants:** numeric unquoted with no commas (`123`, `-123.456`); strings in single or double quotes, escaping the delimiter by doubling it (`'Sally''s'`); booleans `true`/`false`, case-insensitive. **Smart quotes are not recognized.**

---

## 3. Control flow

### Conditionals

Exactly four statements: `IF`, `ELSEIF`, `ELSE`, `ENDIF`. **`ELSEIF` and `ENDIF` are single words. `THEN` is required.**

```
%%[IF expression1 == expression2 THEN]%%
    content
%%[ELSEIF expression1 == expression3 THEN]%%
    content
%%[ELSE]%%
    content
%%[ENDIF]%%
```

- `ELSEIF` — unlimited
- `ELSE` — at most one, after all `ELSEIF`s
- `ENDIF` — exactly one
- Blocks nest

**Operators:** `==` `!=` `>` `<` `>=` `<=` · **Logical:** `AND` `OR` `NOT` · **Grouping:** parentheses are supported.

Omitting the operator implies `== True`: `IF NOT EMPTY(expression) THEN`.

### Loops — `FOR` / `NEXT` only

```
%%[FOR @i = <start> TO|DOWNTO <end> DO ]%%
    content
%%[NEXT @i]%%
```

- Start and end must evaluate to an **integer**, not a decimal
- The counter moves by exactly **1** — there is no step control
- The counter is locked inside the loop
- `NEXT` may optionally name the counter

**A `FOR` and its `NEXT` must be in the same named or typed script block.** Error text: *"An incomplete IF statement exists in a typed script block. Script statements cannot span named or typed script blocks."* Plain `%%[ ]%%` blocks with HTML between them are fine.

---

## 4. String functions

| Signature | Notes |
|---|---|
| `Concat(1, 2, …)` | As many values as needed. **There is no `+` for concatenation** |
| `Substring(1, 2, 3)` | string, start position (**1-indexed**), max length (optional) |
| `Replace(1, 2, 3)` | source, find, replace |
| `ReplaceList(1, 2, 3, …)` | source, **replacement**, then targets. `ReplaceList('ABCDEFG','X','A','C','E','G')` → `XBXDXFX` |
| `Trim(1)` | Leading **and** trailing whitespace |
| `Uppercase(1)` / `Lowercase(1)` / `ProperCase(1)` | `ProperCase` capitalizes each word |
| `IndexOf(1, 2)` | string, substring → **1-indexed**; `0` if absent |
| `Length(1)` | |
| `Char(1, 2)` | ASCII code, repeat count |
| `StringToDate(1, 2)` | string, charset (default UTF-8) |
| `Format(1, 2, 3, 4)` | value, C#-format string, data format (`Date`/`Number`), culture code |
| `RegExMatch(1, 2, 3, 4, …)` | string, regex, group name or ordinal, then .NET RegexOptions |

```
%%=RegExMatch('ABC_dEF_GHI', '.*_(D..)_.*', 0, 'IgnoreCase', 'Multiline')=%%
```

Named regex groups work: `'.*_(?<FirstNumber>[0-9]+)_.*'` with `'FirstNumber'` as arg 3.

---

## 5. Math functions

**There are no arithmetic operators.** No `+`, `-`, `*`, `/`. Use the functions.

| Signature | Notes |
|---|---|
| `Add(1, 2)` · `Subtract(1, 2)` · `Multiply(1, 2)` · `Divide(1, 2)` | `Subtract(initial, amountToSubtract)`; `Divide(dividend, divisor)` |
| `Mod(1, 2)` | dividend, divisor |
| `Random(1, 2)` | least, greatest — **inclusive both ends** |
| `FormatCurrency(1, 2, 3, 4)` | value, ISO culture code, decimal places, symbol override |
| `FormatNumber(1, 2, 3)` | value, format type, culture code |

`FormatNumber` types: `C` currency · `D` decimal · `E` exponential · `F` fixed · `G` general · `N` number · `P` percent · `R` round-trip · `X` hex. Suffix with precision: `C2`.

```
%%=FormatCurrency(1234.567,"en-US")=%%            →  $1234.57
%%=FormatNumber(-12300099.45678,"N","fr-FR")=%%   →  -12 300 099,46
```

---

## 6. Date and time

| Signature | Notes |
|---|---|
| `DateAdd(1, 2, 3)` | date, integer, unit — `Y` `M` `D` `H` `MI` |
| `DateDiff(1, 2, 3)` | startDate, endDate, unit — see below |
| `DateParse(1, 2)` | date string, boolean return-as-UTC |
| `DatePart(1, 2)` | date, part — `Y` `M` `D` `H` `MI` |
| `FormatDate(1, 2, 3, 4)` | value, date format, time format, culture |
| `Now(1)` | `true` preserves email sent time for post-send resolution |
| `GetSendTime(1)` | `true` returns job start / publish time |
| `SystemDateToLocalDate(1)` / `LocalDateToSystemDate(1)` | |

Accepted input formats: `MM/dd/yyyy` or `YYYY-MM-DD`.

### DateDiff argument order

`DateDiff(startDate, endDate, unit)` — Salesforce documents the result as **the `startDate` subtracted from the `endDate`** (`arg2 − arg1`). Worked example:

```
set @startDate = '2016-08-15 6:30 AM'
set @endDate   = '2017-10-16 8:31 AM'
dateDiff(@startDate, @endDate, "D")   →  427
```

**Pass the earlier date first** to get a positive result; reversed arguments return a negative count that reads like bad data.

### Now() vs GetSendTime()

| | During a send | After list/DE send | After triggered/journey send |
|---|---|---|---|
| `Now()` | Current system time | Current system time | Current system time |
| `Now(1)` | Current system time | Job start time | Job publish time |
| `GetSendTime()` | Current system time | Subscriber send completed time | Subscriber send completed time |
| `GetSendTime(1)` | Current system time | Job start time | Job publish time |

**`Now()` is Central Standard Time with no daylight saving.** Everything derived from it inherits that.

### Format() vs FormatDate()

They interpret the same tokens **differently**. Salesforce's recommendation: *"use the Format() function for date and time formatting that requires a locale setting."*

```
%%=FormatDate("2012-10-05 03:21:34.567890", "MMM DD, YYYY", "HH:MM:SS.MMM", "en-US")=%%
   →  Oct 05, 2012 03:21:34.567
%%=Format('2009-06-15T13:45:30', 'dddd dd MMMM h:mm', 'Date', 'fr-FR')=%%
   →  lundi 15 juin 1:45
```

---

## 7. Logic and utility

| Signature | Notes |
|---|---|
| `IIf(1, 2, 3)` | expression, value if true, value if false. **Not short-circuiting** |
| `Empty(1)` | True for empty string **or** NULL. Also documented as true for an empty rowset; prefer `RowCount()` for new guards — see "Gating an empty rowset" |
| `IsNull(1)` | True if null. Also documented as true for an empty rowset; prefer `RowCount()` for new guards — see "Gating an empty rowset" |
| `IsNullDefault(1, 2)` | value when non-null, value when null |
| `AttributeValue(1)` | attribute name — returns null for a missing attribute |
| `V(1)` | outputs a variable |
| `Output(1)` / `OutputLine(1)` | needs `v()` around a variable |
| `RaiseError(1, 2, 3, 4, 5)` | message, **skip-subscriber boolean (default false)**, API error code, API error number, retain-DE-writes boolean |

**`IIf` evaluates both branches.** Never put a `Lookup()` or `HTTPGet()` in a branch you expect to be skipped.

**`RaiseError` second argument matters enormously.** `RaiseError('msg', true)` skips one subscriber and continues the job. `RaiseError('msg')` — the default — **stops the entire send.**

Salesforce's own caveat: *"RaiseError should not be used to exclude subscribers from a journey, because it will only remove a subscriber from a specific send… tracking and reporting numbers include these emails despite the errors."*

### AttributeValue() vs a bare reference

| | `%%FirstName%%` / bare `FirstName` | `AttributeValue("FirstName")` |
|---|---|---|
| Attribute name known at author time | Fine | Works, more verbose |
| Attribute name **dynamic** (in a variable) | Impossible | **Required** |
| Name has spaces | `[First Name]` | `AttributeValue("First Name")` |
| Attribute may not exist in this context | **Terminates the send** | Returns empty |

```
SET @AttributeName = Lookup('PostalCode','zipcode','PostalCode',Indianapolis)
SET @AttributeValue = AttributeValue(@AttributeName)
```

---

## 8. Data Extension functions

### Reading

| Signature | Notes |
|---|---|
| `Lookup(1, 2, 3, 4, …)` | DE, column to **return**, column to **match**, value. Extra pairs AND together. Returns the **first** match — order not guaranteed |
| `LookupRows(1, 2, 3, …)` | DE, match column, match value. **Max 2,000 rows. Unordered. Case-insensitive** |
| `LookupRowsCS(1, 2, 3, …)` | Case-sensitive variant |
| `LookupOrderedRows(1, 2, 3, 4, 5, …)` | DE, **row count**, `"field ASC"`/`"field DESC"`, WHERE field, WHERE value. Max 2,000; `0` or `-1` returns all up to the cap |
| `LookupOrderedRowsCS(…)` | Case-sensitive variant |
| `Row(1, 2)` | rowset, row number — **1-indexed** |
| `RowCount(1)` | rowset |
| `Field(1, 2, 3)` | row, field name, missing-field behavior: `0` → NULL, default `1` → **error** |
| `DataExtensionRowCount(1)` | DE name |

**Enterprise prefix:** `Lookup`, `LookupRows` and `LookupOrderedRows` accept `Ent.` to reach parent-Enterprise DEs — `LookupRows("Ent.Merchants","ID",200043800)`.

### Gating an empty rowset

Salesforce's data-structures guide documents two supported checks:

- `RowCount(@rows)` — the number of rows, usable directly as the loop bound.
- `Empty(@rows)` / `IsNull(@rows)` — both documented as returning **true** when the rowset contains no data.

**Prefer `RowCount(@rows) > 0`** when writing new code: it names the thing you mean and feeds the `FOR` bound in the same variable. But `IF NOT Empty(@rows) THEN` in existing code is a documented, valid emptiness test — when troubleshooting, do not diagnose it as the defect.

### The canonical loop

```
%%[
Var @rows, @row, @i, @rowCount
Set @rows = LookupRows("Orders","SubscriberKey",_subscriberkey)
Set @rowCount = RowCount(@rows)
if @rowCount > 0 then
  for @i = 1 to @rowCount do
    Set @row = Row(@rows, @i)
]%%
  <tr><td>%%=Field(@row,"ProductName")=%%</td></tr>
%%[
  next @i
endif
]%%
```

### Writing — two families

| Signature | Notes |
|---|---|
| `InsertData(1, 2, 3, …)` | DE, then column/value pairs |
| `UpdateData(1, 2, 3, 4, 5, 6, …)` | DE, **number of WHERE columns**, WHERE col, WHERE val, SET col, SET val |
| `UpsertData(…)` | Same shape as `UpdateData` |
| `DeleteData(1, 2, 3, …)` | DE, then column/value pairs |
| `InsertDE` / `UpdateDE` / `UpsertDE` / `DeleteDE` | **Send-time** counterparts |

**The arg-2 count parameter is the classic trap** — it's the number of key column/value pairs, not a row count:

```
%%=UPDATEDE("DE_To_Update",1,"Filter Column","Filter Value","Column","Value")=%%
UpsertDE('ent.CustomObject4',2,'Region','None','Product',_SubscriberKey,'Available',0,'Price',100.77)
```

| | `*Data` | `*DE` |
|---|---|---|
| Context | Landing pages, SMS/MMS, MobilePush, GroupConnect | Send time (email) |
| Timing | Real time, as encountered | **Batched to the end of the send** |
| Returns | Rows affected | Nothing |

**The send-time batching gotcha:** *"the Marketing Cloud takes all applicable AMPscript calls and completes them in one call at the end of the send."* A check-then-`InsertDE` therefore still throws duplicate-key errors. Use `UpsertDE`.

**Writes execute only in the subscriber's preferred email type.** Duplicating a write in both HTML and text parts is a correctness bug.

### Row claiming (coupon codes)

```
ClaimRow(1, 2, 3, 4, …)        DE, boolean claimed column, key column, key value, …
ClaimRowValue(1, 2, 3, 4, 5, 6, …)   DE, column to return, boolean claimed column,
                                     default (positionally required — leave empty), key col, key val
```

```
%%[VAR @CouponRow
SET @CouponRow = ClaimRow('Coupon','IsClaimed','JobID',JobID,'ListID',ListID,'SubscriberID',SubscriberID)
IF EMPTY(@CouponRow) THEN ]%%
No coupons available
%%[ ELSE ]%%
Your code: %%=FIELD(@CouponRow,'CouponCode')=%%
%%[ ENDIF ]%%
```

Note the empty 4th argument when omitting the default: `ClaimRowValue('Coupon','CouponCode','IsClaimed', ,'JobID',JobID)`.

The DE needs a Boolean claimed column, indexes on that plus `_CustomObjectKey`, and nullable key columns. An optional Date column named `ClaimedDate` auto-receives the timestamp.

---

## 9. Content functions

All five content-block functions share the same shape:

```
ContentBlockByName(1, 2, 3, 4, 5)
ContentBlockByID(1, 2, 3, 4, 5)
ContentBlockByKey(1, 2, 3, 4, 5)
ContentArea(1, 2, 3, 4, 5)          ← Classic Content only
ContentAreaByName(1, 2, 3, 4, 5)    ← Classic Content only
```

| Arg | Meaning |
|---|---|
| 1 | Name (full path) / ID / External Key |
| 2 | Impression region name |
| 3 | Boolean — error on not-found. **Defaults to `true`** |
| 4 | Default content on error |
| 5 | **Output** param: `0` found, `-1` not found or invalid |

```
%%=ContentBlockByName("Content Builder\Weekly Portfolio")=%%

/* defensive: suppress the error, fall back to a default block */
%%=ContentBlockByName("Content Builder\Opt Out Form 2","",0,ContentBlockByName("Content Builder\Opt Out Form Default"))=%%
```

**In subject lines and from lines these must target a Code Snippet block** — *"For text-only parts of the email, such as From Address, From Name, or Subject Line, reference the code snippet block."*

Other content functions:

| Signature | Notes |
|---|---|
| `TreatAsContent(1)` | Re-parses a string as content so embedded AMPscript resolves |
| `TreatAsContentArea(1, 2, 3)` | key, content, impression region |
| `BuildRowsetFromString(1, 2)` | string, delimiter → rowset with **one unnamed column**, addressed by ordinal |
| `BuildRowsetFromXML(1, 2, 3)` | XML, XPath, return-empty-on-error — **send time only** |

```
Field(Row(BuildRowSetFromString('123|456','|'), 1), 1)
```

---

## 10. Encoding, hashing, HTTP

| Signature | Notes |
|---|---|
| `Base64Encode(1)` / `Base64Decode(1, 2, 3)` | decode arg 3: `0` proceed on error, `1` fail send (default) |
| `MD5(1, 2)` · `SHA1` · `SHA256` · `SHA512` | arg 2 charset — **changes the hash** |
| `GUID()` | |
| `URLEncode(1, 2, 3)` | URL; arg 2 `1` encodes all illegal chars; arg 3 `1` encodes the full string |
| `HTTPGet(1, 2, 3, 4)` | URL, continue-on-error, empty-content handling (`0` allow / `1` error / `2` skip subscriber), **output** status var |
| `HTTPPost(1, 2, 3, 4, 5, 6, …)` | URL, content-type, payload, **output** status var, header pairs |
| `HTTPPost2(1, 2, 3, 4, 5, 6, 7, 8, …)` | URL, content-type, payload, throw-exception bool, **output** status var, **output** response body var, header pairs |
| `RedirectTo(1)` | Wraps a URL for click tracking |

**HTTP works only on port 80 and 443.** Non-standard ports fail.

`HTTPPost2` is the one that returns the response body; `HTTPPost` does not.

`HTTPGet` status codes: `0` OK, `-1` missing URL, `-2` request error, `-3` empty content.

`HTTPGet` on `view_email_url` needs a context guard or the send fails:

```
%%[IF _messagecontext == "SEND" AND jobid > 0 THEN
set @HTMLContent = HTTPGet(view_email_url)
ENDIF]%%
```

---

## 11. CloudPages and execution context

| Signature | Notes |
|---|---|
| `RequestParameter(1)` | Query string **or form POST** |
| `QueryParameter(1)` | Query string only |
| `CloudPagesURL(1, 2, 3, …)` | Page ID, then param name/value pairs — encrypts the query string |
| `MicrositeURL(1, 2, 3, …)` | Enterprise 2.0 parent-BU pages |
| `Redirect(1)` | Server-side redirect on a landing page |

`MicrositeURL` reserved query-string names you cannot use: `l`, `v`, `s`, `d`, `m`, `n`.

**Execution context** — read-only `@@ExecCtx`, value `Load` or `Post`, defaults to `Load`:

```
%%[ IF @@ExecCtx == "LOAD" THEN]%% … %%[ELSEIF @@ExecCtx == "POST" THEN]%% … %%[ENDIF]%%
```

Named/typed blocks: `%%[[name="UpdateDate";type="Post"]UpsertData(…)]%%`. Script blocks must complete within the same block section.

---

## 12. What AMPscript does NOT support

| Missing | Workaround |
|---|---|
| **`WHILE` loops** | `FOR` to a known bound with an early-exit flag, or SSJS |
| **Native arrays** | `BuildRowsetFromString()`, `LookupRows()` rowsets, or SSJS |
| **Arithmetic operators** `+ - * /` | `Add()` `Subtract()` `Multiply()` `Divide()` |
| **String concat with `+`** | `Concat()` |
| **`try`/`catch`** | `Empty()`/`IsNull()` guards, `RaiseError()`, error-suppressing args on content functions. try/catch is SSJS only |
| **User-defined functions** | Content blocks plus `ContentBlockByName()`, or SSJS |
| **Recursion** | Explicitly errors — **104 RecursiveScriptError** |
| **`break` / `continue`** | Flag variable plus an `IF` inside the loop |
| **`switch` / `case`** | `IF`/`ELSEIF` chain, or GTL `{{#switch}}` |
| **Direct rowset access via `v()`** | `Row()` + `Field()` |
| **Multi-variable `SET`** | One `SET` per variable |
| **Loop step control** | The counter moves by 1 only |
| **Non-standard HTTP ports** | — |
| **`//` comments** | `/* */` |

Other caps: `LookupRows` 2,000 rows · dynamic link aliases cap at 100 unique resolved link names · script blocks cannot span named or typed blocks.

---

## 13. GTL quick reference

```
{{#if order=="1234"}}Ready{{.else}}Not ready{{/if}}
{{#unless order=="1234"}}Not ready{{.else}}Ready{{/unless}}
{{#each people}}<li>{{.this}}</li>{{/each}}
{{#with story}}<div>{{{intro}}}</div>{{/with}}
{{#switch}}
  {{.when State == "NY"}} Eastern
  {{.when State == "IL"}} Central
{{/switch}}
```

**Note the leading dot on `{{.else}}` and `{{.when}}`** — SFMC-specific, unlike stock Handlebars.

**Sections and inverted sections:**

```
{{#example}}{{exampleID}}: {{name}}{{/example}}
{{#example}}{{.}}{{/example}}              ← "." is the current array item (SFMC extension)
{{#example region=regionName}}{{.}}{{/example}}   ← impression tracking (SFMC extension)
{{^example}}No example available.{{/example}}
```

**Values that trigger an inverted section:** `null`, `undefined`, `false`, `0`, `NAN`, `""`, `[]`

**Calling AMPscript from GTL:**

```
{{@FirstName}}                     ← reads an AMPscript variable
{{=Add(1,1)}}                      ← calls an AMPscript function
{{=MyFunction("string", "12/1/12", true, 123, fieldname, [fieldname])}}
```

String and date literals must be quoted; numeric literals optionally.

**Escaping / raw:** `{{& VariableName}}` or `{{{VariableName}}}`
**Names with spaces:** `{{[example 1]}}` — escape `]` by doubling it
**Comments:** `{{! example }}` / `{{!-- example --}}`
**Whitespace strip:** `{{~something}}`

---

## Sources

Salesforce: [Programmatic content overview](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/programmatic-content-overview.html) · [Function calls](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/functionCalls.html) · [Language elements](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/languageElements.html) · [Personalization strings and AMPscript](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/personalizationStringsAMPscript.html) · [Order of operations](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/orderOfOperations.html) · [AMPscript processing during sends](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/ampscriptProcessing.html) · [Data modification functions](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/dataModificationFunctions.html) · [GTL syntax guide](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/gtlSyntaxGuide.html) · [GTL block helpers](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/gtlBlockHelpers.html) · [Execution context](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/executionContext.html) · plus [ampscript.guide](https://ampscript.guide/), the community reference, for worked examples.
