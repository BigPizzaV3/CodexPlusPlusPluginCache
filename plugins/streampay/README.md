# Plugin StreamPay

Plugin łączy obsługiwanych asystentów AI z kontem twórcy StreamPay. Pozwala sprawdzać wpłaty i statystyki, odczytywać ustawienia widgetów oraz zmieniać obsługiwane ustawienia widgetów i strony wpłat. Logowanie odbywa się przez StreamPay OAuth 2.0. Użytkownik widzi zakres wymaganych uprawnień i sam je akceptuje.

## Zawartość

- `plugin.json` i `mcp.json` zawierają przenośny pakiet Agent Plugins używany przez OpenAI.
- `.claude-plugin/plugin.json` i `.mcp.json` zawierają pakiet dla Claude Code.
- `skills/managing-streampay/SKILL.md` zawiera wspólne instrukcje dla asystenta.

## Połączenie

Plugin łączy się z `https://api.streampay.pl/mcp`. Repozytorium nie zawiera klucza API, hasła, danych konta recenzenta ani innych sekretów. Logowanie odbywa się w przeglądarce przez StreamPay OAuth.

Pełna instrukcja znajduje się w [poradniku StreamPay MCP](https://wiki.streampay.pl/pl/poradniki/jak-polaczyc-asystenta-ai-ze-streampay-przez-mcp).

## Test w Claude Code

Uruchom Claude Code w katalogu repozytorium:

```bash
claude --plugin-dir .
```

Połącz serwer MCP `streampay`, a następnie użyj jednego z przykładowych poleceń zapisanych w skillu.

## Informacja dla recenzentów

Reviewer credentials are intentionally excluded from this public repository. StreamPay provides the dedicated review account and sign-in instructions only through the secure Anthropic or OpenAI submission form.
