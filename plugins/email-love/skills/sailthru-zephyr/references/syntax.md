# Zephyr — Syntax and Function Reference

Zephyr is Zeta Engage by Sailthru's templating language. Everything happens inside single curly braces, and everything that transforms a value is a **function call**, never a filter pipe.

## Contents

1. [Delimiters and comments](#1-delimiters-and-comments)
2. [Single vs double braces](#2-single-vs-double-braces)
3. [Expressions and operators](#3-expressions-and-operators)
4. [Assignment](#4-assignment)
5. [Control structures](#5-control-structures)
6. [Lambdas and list comprehensions](#6-lambdas-and-list-comprehensions)
7. [The function catalogue](#7-the-function-catalogue)
8. [Defaults, falsiness, and the Elvis operator](#8-defaults-falsiness-and-the-elvis-operator)
9. [Reserved words and naming](#9-reserved-words-and-naming)
10. [Does not exist in Zephyr](#10-does-not-exist-in-zephyr)

---

## 1. Delimiters and comments

```zephyr
{expression}              evaluate and print
{if x}…{/if}              a control structure is also just braces
{x = 1}                   assignment; prints nothing
{* a comment *}           does not render
{include 'snippet-name'}  pull in a Code Snippet
```

**A space after the opening brace disables the tag.** Sailthru: *"Be sure not to include a space immediately following your opening bracket. If you do, your code won't be recognized as Zephyr."*

```zephyr
{name}      ✅
{ name }    ❌ ships as literal text
```

**Comments are `{* … *}`.** Sailthru contrasts them with HTML comments specifically: Zephyr comments *"will not render and are not visible to end users."* An HTML comment ships to the recipient. Do not use `<!-- -->` to disable Zephyr.

**Closing tags are `{/if}`, `{/foreach}`, `{/case}`, `{/switch}`, `{/select}`.** There is no `end` keyword.

**Line breaks inside a function call are only documented as safe for `personalize()`**: *"Line breaks are supported within the `personalize` function… however, this is not the case for other Zephyr functions."* Keep every other call on one line.

---

## 2. Single vs double braces

This is the most misread rule in Zephyr, because both forms print a value and neither is "the statement form."

| Mode | `{single}` | `{{double}}` |
|---|---|---|
| **Dynamic** campaign | identical | identical |
| **Static** campaign | evaluated **at campaign creation time**, once overall | evaluated **at send time**, once per user |

Sailthru's example:

```zephyr
generated on {date()} sent on {{date()}}
```

Generate the campaign on one day and send it the next, and recipients see the creation date in the first slot and the send date in the second.

The consequence that bites: in static mode, `Hello, {profile.vars.first_name}.` renders as `Hello, .` — there is no user at creation time. Per-user values in a static campaign need `{{ }}`.

Static mode is for content you intend to hand-edit as HTML before it goes out. Anything user-specific — personalization, sharing links, ad slots — uses double braces.

---

## 3. Expressions and operators

*"Anything inside `{curly braces}` is evaluated as an expression. Expressions are constructed using a Javascript-like format."*

| Category | Operators |
|---|---|
| Comparison | `==` `!=` `>` `>=` `<` `<=` |
| Boolean | `&&` (and) · `\|\|` (or) · `!` (not) |
| Math | `+` `-` `*` `/` `%` |
| Grouping | `( )` — **parentheses are supported**, unlike some other ESP languages |
| Ternary | `cond ? a : b` |
| Elvis | `a ?: b` |

```zephyr
{if 2 == 2.0}this will display{/if}
{if true || false}so will this{/if}
{if !source}Hey {name}, we don't know where you came from!{/if}
{5*(3+1)}                                    20
```

**Parentheses are required around a modulo comparison.** Sailthru: *"Parentheses necessary around the modulo operator when using a comparison."*

```zephyr
{if (i % 2) != 0}odd{/if}
```

**Types**

- **Strings** — single or double quotes, backslash escapes: `{'What\'s up?'}`. **Double quotes are not supported in Email Composer** — *"Use single quotes in Email Composer so your Zephyr renders properly."*
- **Numbers** — integers and floats both supported.
- **Booleans** — `true` / `false`.
- **Arrays** — JSON syntax, zero-indexed: `{myvar = [1,2,'three']}` then `{myvar[2]}`.
- **Objects** — JSON syntax, dot or bracket access: `{myvar.attrib2}` or `{myvar['attrib2']}`.

**`+` is overloaded by type.** On numbers it adds; on strings it concatenates; on lists it appends; on objects it **merges** (`object1` with all of `object2`'s keys copied on).

```zephyr
{'Zephyr' + ' is fun'}                       Zephyr is fun
{[1,2,3] + [4,5,6]}                          [1,2,3,4,5,6]
{{'a':1,'b':2} + {'b':3,'c':4}}              {'a':1,'b':3,'c':4}
```

**Hyphenated keys need bracket-and-quote notation.** Sailthru's rule for feed data: `{content['real-estate'][0].title}`, never `{content.real-estate[0].title}`. Underscores are preferred in feed keys for this reason.

---

## 4. Assignment

```zephyr
{variable = value}
{variable.attribute = value}
```

Assignment prints nothing and *"only applies to the particular message you are sending and will not cause any kind of permanent update to your data."* Setting `{name = 'Friend'}` does not write `Friend` to the profile.

```zephyr
{if !name}{name = 'Friend'}{/if}
Dear {name},

{allLists = ['Books', 'Politics', 'Tech']}
{personalized = horizon_select(content, 10)}
```

Objects and arrays of objects can be built inline the same way.

**Scope matters and is not uniform.** Code in the template's **Setup** field (Advanced tab) runs *"prior to rendering code in the template body"* and its variables are visible to the body. Code in a **link** is *"evaluated in its own scope, outside of the regular HTML body"* — a variable assigned in the body is **not** visible inside an `href`. Assign anything a link needs in Setup.

**You cannot mutate the collection you are iterating.** Sailthru gives the failing case explicitly:

```zephyr
{obj = {'a':1, 'b':2}}
{foreach obj as k, v}
  {obj.c = 3}          ❌ results in an error
{/foreach}
```

---

## 5. Control structures

### `{if}`

```zephyr
{if expression}result{/if}
{if expression1}result 1{else if expression2}result 2{else}result 3{/if}
```

*"For `if`'s purposes, `0`, `""` (empty string), `null`, and `false` all evaluate to `false`, and anything else evaluates to `true`."* A variable that does not exist *"will return false"*, which is what makes `{if first_name}` a valid presence check.

Note the spelling: **`{else if}`**, two words. Any number of `{else if}` branches is allowed.

### `{foreach}`

```zephyr
{foreach expression as variable} … {/foreach}
{foreach expression as keyvar, valuevar} … {/foreach}
```

In the key/value form over a list, the key is *"the integer index of the item (starting at 0)."*

```zephyr
{foreach content as c}
  <a href="{c.url}">{c.title}</a>
{/foreach}

{foreach content as i, c}
  <li>Item #{i+1}: {c.url}</li>
{/foreach}
```

`{break}` terminates the loop; `{continue}` skips to the next item.

```zephyr
{foreach content as c}
  {if !c.image}{continue}{else}<a href="{c.url}">{c.title}</a>{/if}
{/foreach}
```

There is no `limit` argument. To cap a loop, slice the array first (`{foreach slice(content, 0, 3) as c}`) or `{break}` on the index.

### `{switch}` and `{select}`

```zephyr
{switch office}
  {case 'NY'}Thanks for signing up at our New York office!{/case}
  {case 'LA'}Thanks for checking in with us in LA!{/case}
{/switch}
```

`{switch}` *"picks the first one that matches the value."*

```zephyr
{select}
  {case horizon_interest('menswear,fashion')}Check out our new suits!{/case}
  {case horizon_interest('purses')}Try our new purses{/case}
{/select}
```

`{select}` *"evaluates them all and picks the one with the highest numeric value. If there is a tie, the tie will go to the earlier `{case}`."* It exists for interest scores; it is not a general switch.

### Ternary

```zephyr
<p>Dear {gender == 'M' ? 'Mr.' : 'Ms.'} {last_name},</p>
{first_name ? first_name + ', h' : 'H'}i there!
```

---

## 6. Lambdas and list comprehensions

Zephyr borrows both from Python, and they are how filtering and mapping are expressed.

```zephyr
lambda x: x*2
lambda x,y: (x != y)
```

```zephyr
{content = filter_content(content, lambda x: contains(x.tags, 'furniture'))}
{sort(content, lambda a,b: a.price - b.price)}
```

List comprehensions: `[map for varname in list]` or `[map for varname in list if condition]`.

```zephyr
{[x*2 for x in [1,2,3,4,5]]}                    [2,4,6,8,10]
{[x for x in [1,2,3,4,5] if x > 2]}             [3,4,5]
{content = [c for c in content if contains(c.tags, 'football')]}
```

A comprehension over a feed does **not** preserve Recommendations pinning. Use `filter_content()` when pinning matters — see `references/data-sources.md`.

---

## 7. The function catalogue

Signatures below are Sailthru's own. Everything is a call; nothing is a pipe.

### String

| Function | Signature | Notes |
|---|---|---|
| `upper` | `string upper(string)` | |
| `lower` | `string lower(string)` | |
| `title` | `string title(string)` | Capitalizes the first character of every word; *"other letters are left untouched"*, so wrap in `lower()` first to normalize |
| `substr` | `substr(string, int start [, int length])` | |
| `replace` | `string replace(string input, string search, string replace)` | All occurrences |
| `split` | `list split(string, string delimiter)` | |
| `join` | `string join(mixed haystack, string delimiter)` | |
| `strpos` | `integer strpos(string haystack, string needle[, int offset])` | First occurrence |
| `strrpos` | `integer strrpos(string haystack, string needle, int offset)` | Last occurrence |
| `first` | `mixed first(mixed input [, string prior])` | On a list, the first element. **On a string, the first word** — the documented way to get a first name out of `name` |
| `length` | `integer length(mixed)` | Items in a list, keys in an object, characters in a string |
| `contains` | `boolean contains(mixed haystack, mixed needle)` | Works on lists, strings, objects |

### Array and object

| Function | Signature | Notes |
|---|---|---|
| `slice` | `list slice(list, int offset [, int length])` | The way to cap a loop |
| `map` | `list map(list, lambda)` | |
| `filter` | `list filter(list, lambda)` | **Destroys Recommendations pinning on a feed** |
| `filter_content` | `list filter_content(array, lambda)` | Preserves pinned items |
| `dedupe` | `array dedupe(array [, string field])` | Default field is `url`. Destroys pinning |
| `sort` | `list sort(list [, mixed sortmethod])` | **Mutates.** See the warning below |
| `shuffle` | `shuffle(array)` | Randomizes order |
| `push` | `push('array_name', value)` | Appends |
| `list` | `list list(mixed)` | Casts anything to a list |
| `set` | `set(string arrayName, [values])` | Equivalent to `{arrayName = [...]}` |
| `range` | `range()` | Builds a range array |
| `keys` | `list keys(object)` | |
| `values` | `list values(object)` | |
| `intersect` | overlap of two lists | |
| `content_intersect` | `array content_intersect(array, array)` | Overlap of two content arrays |
| `bucket_list` | `object bucket_list(list source, mixed bucketmethod)` | Splits a feed into named sections |

**`sort()` has two documented side effects.** *"This function modifies the list that is passed."* And, more surprising: *"Calling `sort()` anywhere in the template will sort the entire content array, regardless if it's assigned to a specified variable."* It also *"cannot sort nested values. It only sorts top-level values."*

```zephyr
{sort(content, 'order')}     ascending by field
{sort(content, '-price')}    descending — the leading minus reverses
{sort([5,3,12,4,1])}         [1,3,4,5,12]
```

### Number

| Function | Signature | Notes |
|---|---|---|
| `number` | `string number(float [, mixed precision])` | Rounds and adds comma separators. A string second argument is passed to Java's `DecimalFormat` |
| `int` | `integer int(mixed)` | Casts; a float is **rounded down** |
| `round` | `round(number)` | |
| `abs` | `abs(number)` | |
| `exp` | `exp(value, power)` | |
| `sqrt` | `sqrt(number)` | |
| `random` | `float random([int limit])` | No argument: float in `[0.0, 1.0)`. With an integer: int in `[0, limit)` |
| `compare` | compares two integers or strings | |

**Prices are cents.** `{number(c.price/100, 2)}` — see `references/data-sources.md`.

### Date and time

| Function | Signature |
|---|---|
| `date` | `string date(string format [, int timestamp])` |
| `time` | `integer time([string input [, int now]])` |

`date()` formats *"according to the rules of Java's SimpleDateFormat class."* Not strftime.

| Letter | Component | Example |
|---|---|---|
| `y` | Year | `2012`; `12` |
| `M` | Month in year | `July`; `Jul`; `07` |
| `d` | Day in month | `10` |
| `E` | Day in week | `Tuesday`; `Tue` |
| `a` | AM/PM marker | `PM` |
| `H` | Hour, 0–23 | `0` |
| `h` | Hour, 1–12 | `12` |
| `m` | Minute in hour | `30` |
| `s` | Second in minute | `55` |

Repeat a letter to lengthen the form: `{date('E')}` → `Mon`, `{date('EEEE')}` → `Monday`.

```zephyr
{date('MMM dd, yyyy')}                          send date, formatted
{date('MMM dd, yyyy', content[0].date)}         a feed item's UNIX timestamp
{date('MMMM dd, yyyy', time('now'))}
{date('MMM dd, yyyy', time('+1 week'))}
```

`time()` returns a UNIX timestamp and parses generously — *"in a manner similar to (but not identical to) PHP's strtotime"* — accepting `'Jan 31, 2012'`, `'1/31/12'`, `'3 PM'`, `'+60 minutes'`, `'-1 year'`, `'+2 weeks Wednesday 3 PM'`.

Two documented caveats:

- **There is no timezone control.** *"The time always defaults to the client's timezone. A timezone cannot be designated."*
- **In the web view of an email, `time()` uses page-load time**, not send time. *"To ensure you are using the time that the email was sent, use the `date` function."*

Dates and times *"are parsed separately, and must be separated by a space."*

### Escaping, hashing, HTML

| Function | Signature | Purpose |
|---|---|---|
| `u` | `string u(string)` | **URL-encode.** Use on every value entering a query string |
| `h` | `string h(string)` | **HTML/XML-escape.** Use on user-generated content landing in HTML |
| `strip_tags` | `string strip_tags(string)` | Removes all HTML tags; for cleaning messy feed fields |
| `text` | `text(code)` | Converts a whole message to text-only for the Text Version; used with the `rendered_html` var |
| `md5` | `string md5(string)` | 32-char hex |
| `sha1` | `sha1(value)` | |
| `sha256` | `sha256(value)` | |
| `base64_encode` / `base64_decode` | | |

There is no `url_encode`, no `escape`, no `urlencode`. It is `u()` and `h()`.

### Content, personalization, and Recommendations

| Function | Signature | Notes |
|---|---|---|
| `personalize` | `list personalize(object data)` | The current recommendation engine. Algorithms: `popular`, `trending`, `context`, `purchased`, `viewed`, `interest`, `random`, `custom` |
| `horizon_select` | `list horizon_select(array, int quantity [, string engine [, object filter_tags]])` | Legacy; `personalize` with `"algorithm":"interest"` replaces it |
| `horizon_interest` | `float horizon_interest(string tag)` | `1` = average user's interest, `2` = twice that. Comma-separated tags return the highest |
| `horizon_count` | `horizon_count('tag[,tag]')` | Pageview count for a tag |
| `horizon_set_interest` | `horizon_set_interest(mixed tags, float score [, bool only_increase])` | *"has no permanent impact on the user and only affects subsequent calls within the current message scope"* |
| `promotion` | `object promotion()` | Assigns one unique unused code. `{promotion().code}`, `{promotion().vars.terms_and_conditions}` |

### Suppression

| Function | Signature | Fires when |
|---|---|---|
| `assert` | `assert(mixed expression [, string failuremessage])` | Sends when **true**; terminates the script when false/null/0/`""` |
| `cancel` | `cancel(mixed input)` | **Cancels** when true |

Both belong in the template's **Setup** field. Both carry the documented note that they *"will not stop a Lifecycle Optimizer flow."* Full behaviour in `references/troubleshooting.md`.

Sailthru's published `cancel()` signature takes one argument, but every documented example passes a second reason string — `{cancel(length(content) < 1, 'no content')}`. Treat the reason string as supported and the signature as under-documented.

### Sharing, identity, and side effects

| Function | Notes |
|---|---|
| `message_id()` | The message ID of a campaign or transactional; used in link parameters |
| `signup_confirm(lists)` | Returns an opt-in URL for the given list array |
| `public_share(type [, status_message])` | Non-personalized shareable URL |
| `social_share(mode, url [, …])` | Per-item share URL |
| `user_engagement()` | Integer 0–6 |
| `user_geo_home(field)` · `user_geo_select_region(regions)` · `distance(lat1, lon1, lat2, lon2 [, units])` | Geolocation |
| `type(value)` | Data type of a value |
| `ad()` · `adinfo()` | AdTargeter sections |
| **`api_user(options [, id])`** | **Writes to the profile.** Sets vars, list membership, opt-out status |
| **`api_event(object)`** | **Fires an event** |
| **`api_send(template [, email [, vars …]])`** | **Sends another message** |
| **`append_user_var(name, value [, cap])`** | **Writes to a profile array**, newest first, oldest evicted at the cap |

The last four have real side effects on user data and on sending. `api_user`, `api_event`, and `api_send` are documented as *"for use only within a trigger custom Zephyr script."* Never place them in code assembled from feed, profile, or partner content.

---

## 8. Defaults, falsiness, and the Elvis operator

Falsy: `0`, `""`, `null`, `false`. Everything else is truthy. A variable that was never set *"will return false."*

**The default-value idiom is the Elvis operator `?:`** — *"especially useful if you don't know if a variable is set or not."*

```zephyr
<p>Dear {name ?: 'valued customer'},</p>
<p>Your current status is: {status ?: 'Unknown'}</p>
<p>Dear {first + ' ' + last ?: 'Friend'},</p>
```

For a cascade, use `{if}`:

```zephyr
{if profile.vars.first_name}
Hi, {first_name}!
{else if profile.vars.full_name}
Hi, {first(full_name)}!
{else}
Hi, friend!
{/if}
```

There is **no `default()` function** and no `default:` modifier. If you want a fallback, `?:` or `{if}` are the only two forms.

**What an unguarded, undefined variable *prints* is not documented as a general rule.** One incidental example — static-mode `Hello, {profile.vars.first_name}.` rendering as `Hello, .` — shows blank. Do not rely on that as a contract; guard the value.

---

## 9. Reserved words and naming

Zephyr variables are **case sensitive**.

Sailthru's documented avoid-list for custom variable names:

```
true   false   null   if   else   case   switch   select   for   foreach   lambda
```

Plus every standard variable, because they occupy the same global scope: `beacon`, `beacon_src`, `beacon_ssl`, `beacon_src_ssl`, `beacon_url`, `email`, `emailnum`, `optout_confirm_url`, `profile`, `public_url`, `signup_confirm_url`, `text_url`, `view_url`, and the special-behaviour names `name`, `source`, `text_only`.

Feed keys should use underscores, not hyphens: *"You cannot reference key values with hyphens in Zephyr."* If a hyphen is unavoidable, bracket-and-quote it: `{content['real-estate'][0].title}`. External data feeds *"do not support spaces in variable (var) names."*

---

## 10. Does not exist in Zephyr

Everything in this section is a construct a model trained on Liquid, Jinja, Django, or Handlebars will reach for. None of it works here.

| Reflex | Reality in Zephyr |
|---|---|
| `{{ output }}` / `{% tag %}` split | **No such split.** Single braces do everything. `{{ }}` exists but means *send-time in static mode*, not "output" |
| `{% if %}` `{% for %}` `{% endif %}` | `{if}` `{foreach}` `{/if}`. Percent signs are ZML or Liquid, not Zephyr |
| `\|` filters — `{{ x \| upper }}` | **There is no pipe operator.** `{upper(x)}` |
| `\| default: 'x'` | `{x ?: 'x'}` |
| `\| date: '%b %d'` | `{date('MMM dd', ts)}` — Java `SimpleDateFormat`, not strftime |
| `\| url_encode` / `urlencode` | `{u(x)}` |
| `\| escape` / `\| e` | `{h(x)}` |
| `\| size` / `\| length` | `{length(x)}` |
| `\| join: ', '` | `{join(x, ', ')}` |
| `\| truncate: 40` | `{substr(x, 0, 40)}` |
| `{% assign %}` / `{% set %}` | `{x = value}` |
| `{% capture %}` | No equivalent. Build the string with `+` |
| `{% comment %}` / `{# #}` / `<!-- -->` | `{* … *}` |
| `{% for … limit: 3 %}` | `{foreach slice(content, 0, 3) as c}` |
| `forloop.index` / `loop.index` | `{foreach content as i, c}` — the key is the index |
| `{% include %}` with variables | `{include 'snippet-name'}`. **Includes cannot be nested**; *"Include syntax is not dynamically evaluated"* |
| `{% raw %}` | Not documented |
| Handlebars `{{#each}}` / `{{#if}}` | Not Zephyr at all |
| `abort_message` / `cancel_message` | `assert()` and `cancel()`, in the **Setup** field |
| A timezone modifier on a date | **None exists.** *"A timezone cannot be designated"* |
| Money filters that divide by 100 | None. Prices are cents; divide by hand |

**Undocumented, so test before relying on it:** whether Zephyr inside an HTML comment is still evaluated (the docs only say HTML comments render, which is why `{* *}` is the recommended form); whether `{break}`/`{continue}` behave inside `{switch}`; the precedence order when a send-API var, feed key, and profile var share a name.

---

## Sources

Zeta Engage by Sailthru: [Zephyr Overview](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-syntax/syntax-overview.html) · [Expressions and Operators](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-syntax/expressions-operators.html) · [Control Structures](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-syntax/control-struc.html) · [Assignment Operator](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-syntax/assgn-operator-vars.html) · [Single Vs. Double Braces](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-syntax/single-double-braces.html) · [Template Variables](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-syntax/template-variables.html) · [Functions Index](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/functions-index.html) · [date](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/date.html) · [time](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/time.html) · [number](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/number.html) · [sort](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/sort.html) · [u](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/u.html) · [h](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/h.html) · [assert](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/assert.html) · [cancel](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/cancel.html) · [api_user](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-functions-library/api-user.html) · [Code Snippets](https://products.zetaglobal.com/sailthru/Content/content/data-feeds/code-snippets.htm) · [Zephyr Basics tutorial](https://products.zetaglobal.com/sailthru/Content/developers/zephyr-tutorials/tutorial1.html)
