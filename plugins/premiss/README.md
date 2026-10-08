# Premiss

Turn your next trading idea into a strategy you can test and improve, right from ChatGPT or Claude.

Describe your rules in plain English. Create custom Python strategies, backtest supported crypto, stock, and ETF markets, and see the trades behind the results. Explore drawdowns, inspect equity curves, and compare completed tests with matched buy-and-hold evidence.

Your code, strategies, and notes stay together in your private Premiss workspace. Pick up an earlier idea, refine the rules, and run it again.

Connect your Premiss account and choose a workspace and permissions. Editing existing strategies needs separate edit consent; paper reports need separate read consent. Custom indicators, entry/exit logic, risk rules, and long/short/flat strategies use the app's package format and sandbox. There are no plugin-only daily backtest or history caps. The app's market availability, code validation, and active-run protections apply. Historical backtests record 10,000 simulated capital, 10 bps fees, and 1 bp slippage, with next-bar-open fills.

Historical results are not forecasts. The connection does not place live trades, control bots, expose exchange keys, change billing, or publish content.

Support: https://app.premissai.com/support. Connection instructions: https://app.premissai.com/integrations. Manage or revoke connections: https://app.premissai.com/integrations/connections. Privacy: https://premissai.com/legal/privacy. Terms: https://premissai.com/legal/terms.

The repository contains manifests for both hosts. Packaging produces separate ZIPs with one host's MCP resource and the shared research skill. Hosted Claude uses its web callback; Claude Code's local OAuth callback is not supported. Public directory availability requires each host's review.
