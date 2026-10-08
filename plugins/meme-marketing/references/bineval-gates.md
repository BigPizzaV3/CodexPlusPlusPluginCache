# BinEval Quality Gates & Anti-Cringe Filter

Every meme concept generated or reviewed by the Meme Marketing Agent must pass all 8 binary evaluation (BinEval) gates before being released to the user or published.

---

## The 8 Immutable Quality Gates

| # | Gate Name | Core Question | Pass Criteria | Immediate Failure Signal |
|---|---|---|---|---|
| **1** | **The Send Test** | *Who forwards this to whom?* | Can specify an exact relationship (e.g., *Junior Dev to Tech Lead in private Slack DM*). | Abstract target like "Marketers" or "Anyone who works in tech". |
| **2** | **The Receipt Check** | *Is the scene grounded in tactile reality?* | Contains an authentic, verifiable detail (e.g., `11:47 PM`, `SIGSEGV`, `null pointer`, `v3_final_final2.psd`). | Vague generalities like "when the work gets hard". |
| **3** | **Image-Text Contract** | *Does each element add unique meaning?* | The text and the visual have tension, counterpoint, or dialogue. Neither is complete alone. | Caption describes exactly what the image shows (redundancy). |
| **4** | **Feed Glance Test** | *Does it register at feed speed?* | A scrolling user understands the premise within 1.5 seconds. Clean typography, high contrast. | Wall of text on image requiring more than 2 sentences of explanation. |
| **5** | **Logo-Free Share Test** | *Is it funny without the brand?* | Covering the company logo leaves 100% of the comedic value intact. | The joke only works if the reader knows the company's product features. |
| **6** | **Batch Variety** | *Are concepts genuinely distinct?* | In a batch of 3, all 3 use different comedic mechanisms and distinct visual forms. | 3 rewrites of the same punchline disguised with different adjectives. |
| **7** | **Zero Cringe Guarantee** | *Is it free of corporate desperation?* | No marketing slogans, no URLs or coupon codes in image, no sales CTAs (`"Click here"`). | `"Want to avoid this? Sign up for Acme today!"` inside the meme. |
| **8** | **Cultural Authenticity** | *Is the dialect natural and unpolluted?* | Uses actual spoken dialect idioms. Egyptian sounds Egyptian; Saudi sounds Saudi. | Stiff Modern Standard Arabic or awkward machine-translated English idioms. |

---

## The Anti-Cringe Filter (Automated Rules)

The automated validator checks for these red flags:

```regex
(https?://|www[.]|#[\w]+|\b(?:buy now|order now|sign up|click here)\b|(?:اطلب الآن|اشتر الآن|سجل الآن|اضغط هنا))
```

### Prohibited Patterns:
1. **Promotional Infiltration**: Never place URLs, hashtags, discount codes, or promotional buttons on the meme canvas.
2. **The Product Savior Fallacy**: Never make the product swoop in like a superhero. The product can only appear as:
   - **None**: Meme is purely about shared human suffering/irony (brand equity through resonance).
   - **Prop**: The tool exists in the background of the scene (e.g., open tab on the laptop).
   - **Character**: The tool has its own flaws or personality.
   - **Product-Forward**: Organic narrative role where the tool's behavior directly causes or highlights the comic tension.
3. **Manufactured Slang**: Never force outdated or unnatural slang (e.g., "Hello fellow kids"). If in doubt, use simple everyday conversational phrasing.
