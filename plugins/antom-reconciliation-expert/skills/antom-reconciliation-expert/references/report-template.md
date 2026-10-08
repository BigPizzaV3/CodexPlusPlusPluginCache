# Settlement analysis output checklist

Use the following content order. Omit empty optional subsections.

## 1. Result status

- State whether analysis is conclusive.
- List accepted files by basename only.
- Show file count, data-row count, and rejected or failed files.
- If the report has no data rows, state that fact without inferring why.

## 2. Settlement overview

- Net settlement amount.
- Gross transaction amount in settlement currency.
- Total inline fees.
- Special fee rows and other non-formula rows.
- Reconstruction result and explicit balance difference.

Always display the settlement currency beside monetary amounts when known.

## 3. Formula validation

- Formula rows checked, valid count, and invalid count.
- Non-formula row count and amount.
- For each reported failure: row index, transaction type, expected amount,
  actual amount, and difference.
- Bound the displayed failure list; summarize any remainder.

## 4. Fee analysis

- Total of each non-zero fee field.
- Breakdown by payment method.
- For card rows, include card brand and country when present.
- Fee model counts when determinable from report fields.

## 5. Findings and next steps

- Separate computed facts from interpretation.
- Mark unsupported root-cause explanations as undetermined.
- Recommend the smallest next piece of evidence needed for unresolved items.
- Remind the user that results are analytical support and should be reviewed
  before financial or operational action.
