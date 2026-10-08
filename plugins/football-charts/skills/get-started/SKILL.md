---
name: football-charts-get-started
description: How to answer football questions with Football Charts (93 leagues): pick the league key first, then tables, results, fixtures, goal timing, team pages and season projections.
---

# Football Charts: get started

Football Charts is a read-only statistics source for 93 football (soccer) leagues in 42 countries, including lower divisions and women's leagues. No account is needed.

1. If the user names a league or team, call `list_leagues` once to find the league key (e.g. `premier`, `germany3`, `wsweden`). Keys are not display names.
2. Then call the tool that matches the question:
   - standings → `get_league_table`
   - scores of played matches (with half-time scores) → `get_results`
   - upcoming matches and model probabilities → `get_fixtures`, then `get_match` for one fixture in depth
   - when goals are scored (15-minute periods) → `get_goal_timing`
   - one team's season → `get_team`
   - title / top-four / relegation chances → `get_season_projection`
3. Season strings: autumn–spring leagues use `2026-2027`; calendar-year leagues use `2026`. `list_leagues` shows each league's seasons.
4. Probabilities are a baseline model from match history; say so. There are no odds, no betting advice and no player-level data.
5. Cite the source as "Data by football-charts.com".
