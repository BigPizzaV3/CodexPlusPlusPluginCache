# Fit File Forge for ChatGPT

Fit File Forge lets you ask about your training and put workouts on your Garmin watch from a conversation. Ask how this morning's intervals went, whether your fitness is building, or what's realistic for Sunday's 10K, and ChatGPT answers from your own data. Describe a workout in plain words ("4 × 8 min at threshold on Thursday") and Fit File Forge builds a valid Garmin workout and, when you confirm, sends it to your watch.

## Use it

1. Connect **Fit File Forge** in ChatGPT and sign in with your Fit File Forge account. Activity data needs Garmin Connect linked in Fit File Forge with activity sharing on; see https://www.fitfileforge.com/ai for setup.
2. Ask about a session, a week or a block, for example:
   - "Analyse my latest workout in detail."
   - "Am I getting fitter? Show my last 12 weeks."
   - "What's my predicted 5K time?"
   - "Build me 6 × 800 m at 5K pace for Thursday."
3. Nothing is sent to your watch until you confirm it.

The skills in this plugin guide ChatGPT through debriefing a session and planning a week safely with Fit File Forge's tools.

## Data

The plugin connects to `mcp.fitfileforge.com` on your behalf after you sign in and agree to share. It returns your training summaries, laps and splits, the metrics Fit File Forge computes (fitness and form, time in zones, best efforts, race predictions), your planned workouts, and a cleaned time series of heart rate, pace, power, cadence and elevation; you choose what to allow when you connect. It never returns GPS locations, the original activity files, or health data such as sleep or HRV, which Fit File Forge does not collect. What ChatGPT receives is handled under OpenAI's terms and your ChatGPT settings. Disconnect any time in ChatGPT or in Fit File Forge → Settings → Connected Apps.

- Privacy policy: https://www.fitfileforge.com/privacy
- Terms: https://www.fitfileforge.com/terms
- Setup and FAQ: https://www.fitfileforge.com/ai
- Support: support@fitfileforge.com

Garmin and Garmin Connect are trademarks of Garmin Ltd. or its subsidiaries. Fit File Forge is not sponsored or endorsed by Garmin. Training information is informational, not medical advice.

## License

MIT, see [LICENSE](LICENSE).
