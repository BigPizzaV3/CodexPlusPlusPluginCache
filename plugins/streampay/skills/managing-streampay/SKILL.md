---
name: managing-streampay
description: "Sprawdza wpłaty StreamPay i bezpiecznie zarządza widgetami oraz ustawieniami strony wpłat twórcy. Używaj, gdy twórca pyta o wpłaty, ranking, cele, odliczanie, alerty lub konfigurację strony StreamPay."
license: MIT
compatibility: Wymaga konta twórcy StreamPay połączonego przez OAuth 2.0.
---

# Zarządzanie StreamPay

Używaj narzędzi StreamPay MCP do sprawdzania wpłat i zarządzania obsługiwanymi ustawieniami połączonego konta twórcy.

## Sposób działania

1. Ustal, czy prośba dotyczy wpłat, widgetów, czy strony wpłat.
2. Przed zmianą odczytaj obecne ustawienia widgetu albo strony wpłat.
3. Zmień tylko pola wskazane przez twórcę. Pozostałe wartości muszą pozostać bez zmian.
4. Podsumuj wynik. Wskaż zmieniony widget i pola.

Jeśli prośba jest niejednoznaczna, zadaj jedno konkretne pytanie przed użyciem narzędzia zapisującego. Jasne polecenie, na przykład "ustaw cel na 5 000 PLN", jest zgodą na wykonanie tej zmiany.

## Zasady bezpieczeństwa

- Korzystaj wyłącznie z danych połączonego konta StreamPay.
- Nigdy nie proś o hasła, tokeny dostępu, tokeny zabezpieczające widgety ani prywatne adresy OBS. Nie wyświetlaj ich i nie próbuj ich odgadywać.
- Nie twierdź, że narzędzia StreamPay mogą inicjować wpłaty, zakupy, przelewy, zwroty albo wypłaty środków.
- Nie twierdź, że narzędzia mogą usuwać widgety, zmieniać adres strony wpłat, przesyłać pliki, edytować własny kod albo sterować trwającym odliczaniem.
- Wyjaśnij, że dostępne dane i operacje zależą od zakresów OAuth zaakceptowanych przez twórcę.
- Jeśli narzędzie nie obsługuje danej funkcji, opisz ograniczenie i skieruj twórcę do panelu StreamPay. Nie wymyślaj obejścia.

## Przykładowe polecenia

- "Pokaż moje ostatnie wpłaty i podsumuj dzisiejszą kwotę."
- "Kto wpłacił mi najwięcej?"
- "Wyświetl moje widgety i wyjaśnij ich ustawienia."
- "Pokaż mój obecny cel, a następnie zmień tylko kwotę docelową."
- "Zmień limit długości wiadomości na mojej stronie wpłat."
