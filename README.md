# First Touch — pliki gry

Plik wejściowy zachowuje nazwę **`index.html`**. Kod, style i model bramkarza znajdują się teraz w osobnych plikach. Projekt działa bez instalowania paczek i bez etapu budowania.

## Uruchomienie

Rozpakuj cały ZIP. Prześlij **całą jego zawartość** na hosting, zachowując układ folderów. Otwórz `index.html` przez adres strony. Do gry w goglach użyj hostingu HTTPS.

Do lokalnego podglądu na komputerze uruchom w rozpakowanym folderze:

```sh
python3 -m http.server 8000
```

Następnie otwórz `http://localhost:8000/`. Uruchamiaj grę przez serwer; otwarcie HTML bezpośrednio jako `file://` nie wczyta poprawnie modułów i modelu.

## Co jest gdzie

| Ścieżka | Zawartość |
| --- | --- |
| `index.html` | Ekran startowy i wejście do gry. |
| `styles/main.css` | Wygląd interfejsu strony. |
| `src/main.js` | Wczytanie zasobów i uruchomienie. |
| `src/app.js` | Główna pętla, sesja VR i obsługa zdarzeń. |
| `src/config.js` | Wymiary boiska i podstawowe stałe. |
| `src/player/` | Sterowanie, kalibracja, buty i nogi gracza. |
| `src/physics/` | Fizyka piłki oraz siatki. |
| `src/keeper/` | Zachowanie, animacje i wczytywanie modelu bramkarza. |
| `src/world/` | Boisko, bramki i oświetlenie. |
| `src/render/` | Rysowanie odkształcanej siatki. |
| `src/ui/` | Menu VR i panel kalibracji. |
| `src/audio.js` | Obecne syntezowane efekty dźwiękowe. |
| `assets/models/keeper/` | Dane modelu bramkarza: dwa pliki binarne i opis JSON. |
| `assets/audio/` | Miejsce na przyszłe pliki MP3 oraz ich plan. |
| `vendor/three.js` | Lokalna biblioteka graficzna. |
| `SOUND_EFFECTS.md` | Lista dźwięków do przygotowania. |

Biblioteka graficzna i model są dołączone do paczki. Gra nie pobiera ich z CDN. Model wczytuje się przed odblokowaniem przycisków rozpoczęcia gry.

## MP3

Pełna lista nazw i zastosowań znajduje się w **[SOUND_EFFECTS.md](SOUND_EFFECTS.md)**. Docelowe miejsce na nagrania to `assets/audio/`.

`assets/audio/sound-plan.json` jest specyfikacją do późniejszego podłączenia nagrań. Gra nadal korzysta z obecnych dźwięków syntezowanych i nie próbuje pobierać brakujących MP3. Samo umieszczenie nagrań w folderze nie zmienia jeszcze odtwarzania; integracja nastąpi po dobraniu plików.

Licencja dołączonej biblioteki: [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
