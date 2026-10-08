# Merchant coding

Everything here is a **strong prior to verify**, not a permanent fact. The merchant's acquiring bank assigns the category code, the card issuer only reads it, and neither is obliged to tell the cardholder in advance. `data/merchants.json` holds the machine-readable version; this file explains the reasoning so you can handle merchants that are not in the table.

## The mental model

A card's terms say "6% at U.S. supermarkets". The issuer implements that as "MCC 5411, minus this exclusion list". So three things have to line up:

1. The **merchant** reports a category code to its acquirer.
2. That code falls inside the issuer's definition of the category.
3. The merchant is not separately carved out **by name**.

Step 3 is the one people miss. Amex excludes Walmart and Target from supermarket earning by name, not only by code. Checking the MCC alone gives the wrong answer.

## Fuel

Pay-at-pump fuel is the most reliable coding in retail — it is nearly always a service station code (5541/5542). Almost everything else about a fuel stop is not:

- **Inside the kiosk.** Usually still the station's own code, but a co-branded convenience store on the forecourt can report 5499 and miss a gas bonus entirely.
- **Car washes, auto service, propane.** Often a separate merchant with a separate code.
- **Supermarket and warehouse-club forecourts.** Kroger, Tesco and Costco fuel generally code as gas, not as the parent store — usually good news. Costco fuel is a common exception to a card's "no warehouse clubs" language, but Amex-style gas categories may still exclude it by name.
- **Gift cards at a fuel counter.** Excluded by essentially every issuer.
- **Fuel apps.** Paying inside the Shell or BP app may route through a payment processor that codes differently from the pump.

### India is different

Most Indian issuers award **no reward points at all** on fuel. What they give instead is a waiver of the 1% fuel surcharge the merchant levies, subject to a minimum transaction, a maximum transaction, and a monthly cap.

So at an Indian petrol pump the question is not "which card earns most" — it is "which card waives the surcharge on a transaction this size". A card with a ₹250/month waiver cap and no earning beats a 2% card with no waiver on a ₹2,000 fill. The engine models this through `surcharge_waiver`; pass `surcharge_percent: 1` on the purchase.

## Superstores and warehouse clubs

This is the single biggest source of "why didn't I get my 6%?".

- **Walmart Supercenters and Target** code as discount stores (5310/5311), not supermarkets. Grocery bonus categories do not apply, no matter how much of the basket was food.
- **Costco and Sam's Club** code as warehouse clubs (5300) and are excluded from grocery categories almost universally.
- **Walmart Neighborhood Market** is a different store format that often does code 5411 and can earn the grocery bonus. Confirm which format the user actually visited — they are frequently a few streets apart.
- **Online is not the same as in store.** Walmart.com or Target.com may qualify for an "online retail" or "online grocery" category that the physical store does not.
- **Paying through a merchant's own wallet or app** does not change the merchant category. Walmart Pay is still Walmart.

## Restaurants and delivery

- Sit-down and fast food both code 5812/5814 and are treated the same by most cards.
- **Delivery platforms** usually code as restaurants — but a platform's grocery arm (DashMart, Swiggy Instamart, Uber Eats grocery) often does not.
- **Bars, catering, and restaurants inside hotels or stadiums** frequently code to the venue, not to dining.
- **Coffee-shop app reloads** can code as stored value and be excluded, even though buying the same coffee at the counter earns normally.

## Online and marketplaces

- Amazon third-party sellers usually still bill through Amazon, but separate Amazon businesses (Fresh, Prime Video, AWS, gift cards) can bill under different descriptors and categories.
- "Online retail" categories generally exclude travel, digital goods, gift cards and marketplaces the issuer names explicitly.
- In India, "online spend" categories carry unusually long exclusion lists — rent, wallet loads, utilities, insurance, jewellery, education, government and fuel are the recurring ones. Check the exclusion list, not the headline rate.

## Everything that is not really a purchase

These are excluded from earning on most cards worldwide, and are worth a proactive warning if you see the user heading toward one: rent, mortgage, wallet top-ups, money transfers, cryptocurrency, gift cards, cash advances, tax and government payments, tuition, insurance premiums, EMI conversions, balance transfers, and anything already reversed by a refund.

## Language to use

Say this:

- "likely to code as a gas station"
- "Supercenters are normally excluded from supermarket categories"
- "coding can vary by franchise, location and payment channel"
- "if the difference matters, test with a small transaction and check how it posts"

Not this:

- "Shell codes as 5542"
- "you'll get 6% there"
- "this card is the best for groceries"

The first set survives being wrong. The second set does not.
