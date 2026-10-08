# Marketo — Velocity Email Scripting Reference

Velocity lives **only** inside an Email Script My Token. The email body carries `{{my.script name}}`.

## Contents

1. [Creating and referencing a script](#1-creating-and-referencing-a-script)
2. [The object model](#2-the-object-model)
3. [Field naming — the SOAP API rule](#3-field-naming--the-soap-api-rule)
4. [VTL syntax](#4-vtl-syntax)
5. [The Velocity tools Marketo exposes](#5-the-velocity-tools-marketo-exposes)
6. [Null handling — everything is a String](#6-null-handling--everything-is-a-string)
7. [Dates](#7-dates)
8. [Sorting and filtering lists](#8-sorting-and-filtering-lists)
9. [URLs and link tracking](#9-urls-and-link-tracking)
10. [Limits](#10-limits)
11. [What does not work](#11-what-does-not-work)

---

## 1. Creating and referencing a script

1. Marketing Activities → a program (Event, Default, Engagement) **or** a marketing folder.
2. **My Tokens** tab → drag in an **Email Script** token.
3. Name it → **Click to Edit**.
4. Use the tree on the right to drag in **Person**, **Opportunity**, or **Custom Object** fields.
5. **The token becomes checked/active once you drag it into the editor.**
6. Write the Velocity → Save → Save again.

**The single most common failure:** *"If you are typing in tokens free-form ensure to check/activate all corresponding tokens in the tree or they will be treated as plain text and won't work."* And: *"If a script references a field that is not loaded, the script fails at runtime."*

Dragging is not a convenience — it is the activation mechanism. A perfectly correct script that references an unactivated field does nothing or fails.

**Referencing:** insert `{{my.script name}}` into the email body or template via Insert Token. **The email must be a child of the program that owns the token**, or inherit it from a marketing folder.

**Multiple scripts:** *"If you include more than one Email Script within an email, they execute top to bottom. The scope of variables defined in the first script to execute is available in subsequent scripts."* This is also the workaround for `#parse` / `#include`, which are unusable.

---

## 2. The object model

Documented sources: **Leads, Opportunities, Custom Objects, Mobile App, Mobile App Installation.**

| Reference | What it is |
|---|---|
| `$lead` | The person record |
| `$OpportunityList` | List of opportunities |
| `$<CustomObjectName>List` | List of that custom object's records |
| `$TriggerObject` | The specific record that fired a trigger campaign |

**There is no `$company` object.** Adobe's Marketo Objects doc doesn't list Company or Account as a Velocity source. Marketo *"treat[s] custom Company fields as though they were on the Person/Lead object"* — access them as `$lead.<CompanyFieldVelocityName>`.

### Lists

*"Marketo provides the objects in a list named `<objectName>List`, ordered from the most recently updated record to the least recently updated record."*

```velocity
${OpportunityList.get(0).Amount}
```

Index `0` = most recent, index `9` = oldest at the default limit of 10. Dragging an Opportunity or Custom Object field into the editor automatically retrieves it from index 0.

**Don't rely on the incoming order.** Adobe says last-updated; practitioners report it's actually creation-date descending. Sort explicitly — see §8.

### Relationship depth rules

- **First and second-level** custom objects from a natively-integrated CRM, **directly connected to the Lead or Contact**. **Not third-level.** Custom Objects may not be parents of the Lead or Company.
- **Marketo custom objects:** second-level with a **Parent-Child** relationship (`Lead ← Parent ← Child`) works. **Edge-Bridge** (`Lead ← Bridge → Edge`) does **not**.
- Custom objects may be referenced **through a single connection only** — Lead, Contact, *or* Account, never more than one.
- **SFDC specifically:** the object must have only one relationship to the Marketo lead. Objects are often linked through both contact and account — sync only those with the lead/contact relationship enabled.

### `$TriggerObject`

Available for the **Added to Opportunity**, **Opportunity is Updated**, and **Added to `<Custom Object Name>`** triggers.

**Not supported** for `<Custom Object Name> is Updated`.

**Do not use `$TriggerObject` in a batch campaign.** *"The object is not available in batch campaigns, and the email send fails."* Not degrades — fails.

You still have to select the object's fields in the editing pane.

```html
<ul>
<li>Product Ordered: $!{esc.html($TriggerObject.ProductName)}</li>
<li>Order Total: $!{esc.html($TriggerObject.Amount)}</li>
</ul>
<p><a href="$!{esc.html($TriggerObject.OrderURL)}">View Your Order Online</a></p>
<!-- OrderURL arrives from data: confirm it resolves to an expected HTTPS destination before shipping;
     attribute-escaping formats it for the href but does not make the destination trusted -->
```

---

## 3. Field naming — the SOAP API rule

**A field's Velocity name is its SOAP API name.** Not the display name with spaces removed.

Every Marketo field carries **six** independent names, and they can all differ:

| | Field A | Field B |
|---|---|---|
| Friendly Name | Email | Marketo Data.com ID |
| Token Name `{{lead.X}}` | Email Address | Jigsaw Contact ID |
| Form Field Name | Email | JigsawContactId |
| REST API Name | email | jigsawContactId |
| SOAP API Name | Email | Marketo Jigsaw Contact Id |
| **Velocity Name `$lead.X`** | **Email** | **Marketo Jigsaw Contact Id** |

So "spaces removed" is only sometimes true. `First Name` → `$lead.FirstName`, but many older and system fields keep their spaces.

**When the Velocity name contains spaces, bracket notation is mandatory:**

```velocity
$lead["Marketo Jigsaw Contact Id"]     ## correct
$lead.Marketo Jigsaw Contact Id        ## ParseException
```

**Always get the name by dragging the field from the tree** — that both inserts the correct name and activates the field.

Custom object field names are typically the object's **API name** (SFDC `Product_ID__c`), not a friendly name.

---

## 4. VTL syntax

### Variables and references

```velocity
#set($variable = "value")

$variable       ## outputs 'value'
$variablename   ## outputs '$variablename' — a different, undefined reference
${variable}name ## outputs 'valuename'
```

Formal `${...}` notation is required whenever a reference is adjacent to other characters.

### Quiet reference notation

```velocity
#set($foo = "bar")
$foo     ## outputs "bar"
$baz     ## outputs the literal "$baz"
$!baz    ## outputs nothing
```

*"By default, Velocity leaves the reference string in place when a reference is undefined. A quiet reference emits no value when it is undefined."*

**Use `$!{...}` for every output reference in production.** Without it, a typo or an unactivated field prints `$lead.FirstName` into a customer's inbox.

### Conditionals and loops

```velocity
#if( $condition )
#elseif( $otherCondition )
#else
#end

#foreach( $item in $ItemList )
  ${item.Name}
#end
```

Operators: `==` `!=` `>` `<` `>=` `<=` `&&` `||` `!`

**Loop counters** — `$velocityCount` (1-based), `$foreach.index` (0-based), `$foreach.count` (1-based), `$foreach.hasNext`. These are standard Velocity 1.7 and Marketo links to the 1.7 guide, and `#break` (a 1.7 feature) is confirmed working — but **Adobe never documents them for Marketo.** Test before shipping; a manual `#set($counter = 0)` is the safe pattern.

### Other directives

```velocity
#set( $x = … )
#break                 ## exits the innermost #foreach — confirmed working
#stop                  ## halts rendering
#define( $blockName )…#end
#macro( name $arg )…#end
#evaluate( $string )
```

**`#macro` caveat:** fine for computation, but **links emitted from a Velocimacro break** — the tracking server receives the literal `${documentLink}`.

```velocity
## BROKEN for link output
#macro( outputLink $documentURL )
<a href="${documentURL}">Click to get your document!</a>
#end

## WORKS — use #define
#define( $formatLink )<a href="https://${url}">Click to get your document!</a>#end
```

### Comments

```velocity
## single-line
#* multi-line
   comment *#
```

The `##`-at-end-of-line idiom suppresses the trailing newline, and it's load-bearing in fallback patterns:

```velocity
#if( $lead.FirstName.isEmpty() )
Friend,##
#else
$esc.html($lead.FirstName),##
#end
```

---

## 5. The Velocity tools Marketo exposes

Adobe's documented list: **AlternatorTool, ComparisonDateTool, ConversionTool, DateTool, DisplayTool, MathTool, NumberTool, EscapeTool, LoopTool.**

| Variable | Tool | Status |
|---|---|---|
| `$date` | ComparisonDateTool | Documented, with an Adobe example |
| `$convert` | ConversionTool | Documented |
| `$esc` | EscapeTool | Documented |
| `$display` | DisplayTool | Class listed; `$display` confirmed in practice |
| `$math` | MathTool | Class listed; confirmed |
| `$number` | NumberTool | Class listed |
| `$alternator` | AlternatorTool | Class listed |
| `$loop` | LoopTool | Class listed |
| `$sorter` | SortTool | **Not in Adobe's list**, but works and is widely used |
| `$field` | FieldTool | **Not in Adobe's list**; used for `$field.in($calendar)` constants |

### `$context` does not exist

Marketo **permanently disabled three tools on 14 June 2019**: **`$class`** (ClassTool, including `getClass()`), **`$context`** (ContextTool), and **resourceTool**. Scripts using them fail email compilation and the send fails.

### Useful methods

```velocity
$esc.html($someString)                                  ## HTML-escape
$display.stripTags($lead.TheFieldWithHTML)              ## remove all tags
$display.stripTags($lead.TheFieldWithHTML, "td", "tr")  ## whitelist tags
$math.sub($list.size(), 1)                              ## use $math, not a literal -, to avoid parser conflicts
$math.add($a, $b)   $math.mul()   $math.div()   $math.round()
$number.format("currency", $amount)
$date.whenIs($birthday).days
```

`stripTags` removes tags **without replacement** — `<div>Sandy</div>Whiteman` becomes `SandyWhiteman`.

---

## 6. Null handling — everything is a String

**All Marketo field values arrive in Velocity as Strings**, whatever the Field Management datatype. A Date field is the string `"2016-08-17"` with no date methods until parsed. A Boolean is `""` or `"1"`.

**Marketo ensures Lead field references are always Strings, never `null`.** *"null isn't the same as the empty String that Marketo uses for unfilled Lead fields."*

| Situation | Renders |
|---|---|
| `$lead.FirstName`, field empty | **Empty string** — nothing prints |
| `$lead.Frist_Name` — wrong Velocity name | The **literal `$lead.Frist_Name`** in the email |
| Correct name, but the field **wasn't activated** in the tree | **Script fails at runtime** |
| `$CustomObjectList.get(0).Field` with an actual null | Can be a genuine `null` — **custom objects CAN contain real nulls, unlike lead fields** |
| `$UndefinedList` when no records exist | Literal `$UndefinedList` unless `$!` is used |
| Boolean field, false | **`""`**; true is **`"1"`** |

### Two traps that follow from this

**Never test a Marketo boolean directly.** Both `""` and `"1"` are truthy in `#if($lead.myBool)`. Write `#if( $lead.myBool == "1" )`.

**`$display.alt` does not work on lead fields.**

```velocity
Dear ${display.alt($lead.FirstName,"Friend")},     ## the fallback NEVER fires
```

`$display.alt` substitutes on **null**, and Marketo lead fields are never null — they're empty strings. You get `"Dear Joe,"` or `"Dear ,"`.

### Correct fallback patterns

```velocity
Dear ##
#if( $lead.FirstName.isEmpty() )
Friend,##
#else
$esc.html($lead.FirstName),##
#end
```

Reusable — a computation-only macro, which is safe:

```velocity
#macro ( displayIfFilled $checkValue $fallbackValue )
#if( !($checkValue.isEmpty()) && !($checkValue == $display.get("0")) )
$!{esc.html($checkValue)}##
#else
$!{esc.html($fallbackValue)}##
#end
#end

Dear #displayIfFilled($lead.FirstName, "Friend"),
```

### Encoding — the inverse of token behavior

Velocity output is **not** HTML-encoded, unlike token output. If a field could contain markup or user input, encode it yourself:

```velocity
${esc.html($lead.TheFieldWithHTML)}
```

Conversely, Velocity is how you get **stored HTML to actually render**, since a token would escape it.

---

## 7. Dates

Marketo's arrival formats:

- **Date** fields → `yyyy-MM-dd` (`"2016-08-17"`)
- **DateTime** fields → `"2019-12-07 13:30:00"`

**Parse, then format:**

```velocity
#set($myDate = $convert.parseDate("08-07-2015", "MM-dd-yyyy"))
#set($formattedDate = $date.format("yyyy-MM-dd", $myDate))
${formattedDate}
```

For a Marketo Date field: `#set( $myRealDate = $convert.parseDate($lead.myDateString,'yyyy-MM-dd') )`

**There is no formatting option on a `{{lead.SomeDate}}` token** — reformatting a date is one of the most common reasons to reach for Velocity at all.

### Timezone

**Velocity's default timezone is the server's** — not the recipient's, not your account's. Practitioner guidance is emphatic that setting an explicit IANA zone is mandatory for any `Date` or `Calendar` work.

```velocity
#set( $defaultTimeZone = $date.getTimeZone().getTimeZone("America/New_York") )
#set( $defaultLocale   = $date.getLocale() )
#set( $calNow          = $date.getCalendar() )
#set( $ret             = $calNow.setTimeZone($defaultTimeZone) )
```

### String comparison is lexical

`"80" >= "100"` is **true**. Comparing a string against a numeric literal works (`#if( $lead.myScoreString >= 100 )`); comparing two strings does not. Convert first.

Sorting date **strings** works only for `yyyy-MM-dd`, `yyyy-MM-ddTHH:mm:ssZ`, and `yyyy-MM-dd HH:mm:ss`, where lexical order matches chronological order. Localized formats like `MM/dd/yyyy` must be converted first.

---

## 8. Sorting and filtering lists

**Sorting — `$sorter.sort`:**

```velocity
#set( $sorted = $sorter.sort($customObjList,"updatedAt:desc") )
#set( $byIdAsc = $sorter.sort($ProductInterestList,["ProductId"]) )
#set( $multi = $sorter.sort($ProductInterestList,["ProductId:desc","SignupDate"]) )

#foreach( $obj in $sorter.sort($objList,["maker:asc","purchaseDate:desc"]) )
${obj.maker} - ${obj.purchaseDate}
#end
```

**Velocity sorts Strings case-insensitively.**

**Filtering** — there is no filter tool; use `#foreach` plus `#if`:

```velocity
#foreach( $event in $EventsList )
  #if( $event.location == "Boston" )
    ${event.name}
  #end
#end
```

**First and last element, safely:**

```velocity
#if( $ProductInterestList && !$ProductInterestList.isEmpty() )
#set( $firstItem = $ProductInterestList[0] )
#set( $lastItem  = $ProductInterestList[$math.sub($ProductInterestList.size(),1)] )
#end
```

**Reversing** — no built-in reverse:

```velocity
#set( $reversedList = [] )
#foreach( $itm in $ProductInterestList )
#set( $temp = $reversedList.add( 0, $itm ) )
#end
```

Note the `#set( $temp = … )` idiom — mutating methods return a value that would otherwise print.

---

## 9. URLs and link tracking

Adobe's rule, verbatim: *"To ensure correct URL parsing, set the complete path as a variable and then print it. Do not print variables inside URL references. Include the protocol separately from the rest of the URL. Output a complete anchor (`<a>`) tag so links can be tracked. **Links output from a `for` or `foreach` loop are not tracked.**"*

```html
<!-- Correct — URL-encode the dynamic component with EscapeTool's URL encoder -->
#set($url = "www.example.com/${esc.url($object.id)}")
<a href="https://${url}">Link Text</a>

<!-- Correct -->
<a href="https://www.example.com/${esc.url($object.id)}">Link Text</a>

<!-- Incorrect -->
<a href="${url}">Link Text</a>
<a href="{{my.link}}">Link Text</a>
<a href="https://{{my.link}}">Link Text</a>
```

**An Email Script token inside a tracked link will not compile.** The tracked-link rewrite happens *before* Velocity compiles, so the recipient sees raw script in the address bar. Two fixes:

1. Move the value into a **person field** and use a person token — those work fine in tracked links.
2. **Disable tracking on that link:** `class="mktNoTrack"`

---

## 10. Limits

| Limit | Value |
|---|---|
| Combined Email Script token length per email | **100,000 bytes** — the token strings themselves, not the expanded output |
| **Custom fields referenced by Velocity tokens per email** | **40. Exceed it and the email fails to send** |
| Custom object / opportunity records per person at runtime | **10** by default, index 0–9 |
| Parent Retrieval Limit (configurable) | 10–100, at Admin → Email → Custom Object Retrieval Limits |
| Child Retrieval Limit | **Automatic: 1000 ÷ Parent Limit.** Parent 50 → Child 20 |
| Custom object depth | 2 levels; no third-level; CO may not parent Lead/Company |
| CO relationship paths | Exactly **one** |
| Text My Token size | 524,288 characters (UTF-8) / 2 MB |

---

## 11. What does not work

| Thing | Reality |
|---|---|
| `$context` · `$class` · `resourceTool` | **Permanently disabled June 2019.** Scripts using them fail compilation and the send fails |
| `$company` | Not a documented Velocity object — company fields surface on `$lead` |
| `$display.alt` on a lead field | The fallback never fires; lead fields are empty strings, not null |
| `{{my.script:default=X}}` | `:default=` doesn't work on Email Script tokens |
| `#parse` / `#include` | Parsed as reserved words, but no template repository is exposed. Use multiple script tokens — they share scope, top to bottom |
| `#macro` for link output | The tracking server receives the literal variable. Use `#define` |
| `$TriggerObject` in a batch campaign | **The email send fails** |
| `$TriggerObject` on an "…is Updated" trigger | Not supported — only "Added to…" |
| Links from a `#foreach` loop | Not tracked |
| `{{lead.X}}` inside a Velocity body | Velocity doesn't interpolate tokens. Use `$lead.FieldName` from the activated tree |

**Two errors in Adobe's own published samples** — don't copy-paste them: `${convert.parseDate(...)}` is missing its `$` (should be `$convert.parseDate(...)`), and `#set($objectId = MyCustomObjectList.get(0).objectId)` is missing the leading `$` on the list.

---

## Sources

Adobe: [Email Scripting](https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/email-scripting) · [Marketo Objects](https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/marketo-objects) · [Examples](https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/examples) · [Create an Email Script Token](https://experienceleague.adobe.com/en/docs/marketo/using/product-docs/email-marketing/general/using-tokens/create-an-email-script-token) · [Add an Email Script Token to Your Email](https://experienceleague.adobe.com/en/docs/marketo/using/product-docs/email-marketing/general/using-tokens/add-an-email-script-token-to-your-email) · [Change Custom Object Retrieval Limits](https://experienceleague.adobe.com/en/docs/marketo/using/product-docs/administration/email-setup/change-custom-object-retrieval-limits-in-velocity-scripting) · [KB ka-28507 — 40-field limit](https://experienceleague.adobe.com/en/docs/experience-cloud-kcs/kbarticles/ka-28507) · [Unsupported Velocity Tools Disabled June 2019](https://nation.marketo.com/t5/knowledgebase/unsupported-velocity-tools-disabled-in-june-2019-release/ta-p/251177)

Practitioner reference (Sanford Whiteman / TEKNKL), used for the field-naming rule, null handling, sorting, `#macro` vs `#define`, and reserved words: [every Marketo field has six names](https://nation.marketo.com/t5/product-blogs/every-marketo-field-has-a-friendly-name-a-token-name-a-form/ba-p/358397) · [strings all the way down](https://blog.teknkl.com/marketo-vtl-strings-all-the-way-down/) · [sorting objects and lists](https://blog.teknkl.com/sorting-objects-and-lists-in-velocity/) · [#displayIfFilled](https://blog.teknkl.com/streamline-your-code-with-a-display-if-filled-velocimacro/) · [#macro vs #define](https://blog.teknkl.com/marketo-doesnt-like-velocimacros-for-output-but-define-is-fine/)
