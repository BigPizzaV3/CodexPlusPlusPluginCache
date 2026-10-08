// src/pricing/historical.ts
var GPT3_ERA_PRICING = {
  label: "GPT-3 era",
  year: 2020,
  usdPerMillion: 60,
  rateLabel: "$0.06 per 1,000 tokens",
  basis: "GPT-3 Davinci \xB7 2020 Build overage",
  sources: [
    { label: "Original 2020 pricing table", url: "https://www.alec.fyi/images/gpt-1.png" },
    { label: "Contemporaneous pricing & token FAQ", url: "https://www.reddit.com/r/GPT3/comments/ikorgs/oa_api_preliminary_beta_pricing_announced/" },
    { label: "June 2020 API announcement", url: "https://openai.com/index/openai-api/" }
  ],
  assumptions: [
    "Every recorded token is priced at the same historical rate: uncached input, cached input, and output. There is no cache discount in this scenario.",
    "All model IDs are included, even when their present-day API price is unknown. This hypothetical amount does not change your current API-equivalent estimate.",
    "Modern token counts are held fixed, including reasoning tokens already counted in output. Content is not re-tokenized with the GPT-3 tokenizer.",
    "This is a token-volume thought experiment, not equivalent capabilities or tasks. It does not assume GPT-3 supported modern reasoning or context lengths.",
    "The selected marginal token rate is applied uniformly. Subscription fees, included tokens, free trials, volume agreements, and inflation are not reconstructed."
  ]
};
function calculateGpt3EraCost(totalTokens) {
  if (!Number.isSafeInteger(totalTokens) || totalTokens < 0) throw new RangeError("Historical comparison requires a nonnegative safe integer token count.");
  return totalTokens / 1e6 * GPT3_ERA_PRICING.usdPerMillion;
}
function getHistoricalComparison(totalTokens) {
  return { ...GPT3_ERA_PRICING, totalTokens, estimatedCost: calculateGpt3EraCost(totalTokens) };
}

export {
  GPT3_ERA_PRICING,
  calculateGpt3EraCost,
  getHistoricalComparison
};
