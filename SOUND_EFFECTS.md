# First Touch — lista dźwięków do przygotowania

W aktualnej grze działają **dwa dźwięki generowane w kodzie**: krótki odgłos uderzenia oraz szelest siatki. Odgłos uderzenia jest wspólny dla kopnięcia, słupka/poprzeczki i interwencji bramkarza. Szelest jest wspólny dla kontaktu siatki z piłką i z butem.

Poniżej jest lista nagrań do następnej integracji MP3: **13 podstawowych rodzin dźwięków i 4 opcjonalne**. Na początek wystarczy po jednym pliku z każdej wybranej rodziny. Samo nagranie MP3 może zawierać cały odgłos: atak, główne uderzenie i naturalne wybrzmienie.

Pliki docelowo trafią do **`assets/audio/`**. Ta lista jest specyfikacją nagrań; bieżąca gra nadal korzysta z syntezy, a odtwarzanie MP3 będzie podłączone po dostarczeniu plików.

## 1. Istniejące zdarzenia — najpierw podmiana obecnych dźwięków

Wszystkie poniższe zdarzenia już wywołują dźwięk. Podział kopnięć na trzy nagrania oraz oddzielne brzmienia materiałów są planem podmiany wspólnego syntezatora.

| Nazwa pliku | Co ma być słychać i kiedy | Sugerowana długość | Warianty docelowo |
|---|---|---:|---:|
| `ball_touch_soft_01.mp3` | Lekkie, bliskie dotknięcie piłki butem: prowadzenie, przyjęcie, delikatne przesunięcie. Miękki, krótki kontakt. | 0,08–0,25 s | 3 |
| `ball_kick_medium_01.mp3` | Zwykłe podanie lub średnio mocne kopnięcie. Wyraźny kontakt buta z napompowaną piłką. | 0,12–0,35 s | 3 |
| `ball_kick_hard_01.mp3` | Mocny strzał: szybki, zdecydowany atak i głębszy odgłos piłki. | 0,15–0,50 s | 3 |
| `goal_frame_hit_01.mp3` | Piłka uderzająca w metalowy słupek lub poprzeczkę. Krótki rezonans konstrukcji. Jeden zestaw może obsługiwać oba miejsca. | 0,40–1,40 s | 3 |
| `keeper_glove_save_01.mp3` | Piłka uderzająca w rękawicę bramkarza: tłumiony, ale czytelny plask lateksowej dłoni. | 0,10–0,40 s | 3 |
| `keeper_body_hit_01.mp3` | Piłka odbita tułowiem, ramieniem lub nogą bramkarza: bardziej głuchy kontakt z ciałem i materiałem stroju. | 0,10–0,35 s | 2 |
| `goal_net_ball_01.mp3` | Piłka wpadająca w siatkę: uderzenie, naprężenie i krótki szelest luźnych sznurków. | 0,30–1,00 s | 3 |
| `goal_net_boot_01.mp3` | But poruszający siatkę: szuranie i rozciąganie sznurków, delikatniejsze niż uderzenie piłki. | 0,25–0,90 s | 3 |

Przygotuj **8 plików**, jeśli chcesz zacząć od podmiany tego, co już słychać. Dla każdego dźwięku można później dodać nagrania `_02.mp3` i `_03.mp3`; będą to różne wykonania tego samego zdarzenia.

## 2. Podstawowe efekty do dodania

Te efekty nie mają jeszcze własnego wyzwalania audio. Uzupełnią odgłosy ruchu i istniejących interakcji.

| Nazwa pliku | Co ma być słychać i kiedy | Sugerowana długość | Warianty docelowo |
|---|---|---:|---:|
| `ball_bounce_grass_01.mp3` | Odbicie piłki od murawy. Krótki, bardziej miękki odgłos niż kopnięcie; siła dźwięku zależna od uderzenia o podłoże. | 0,10–0,40 s | 3 |
| `ball_roll_grass_loop.mp3` | Bardzo ciche, ciągłe toczenie piłki po murawie. Pętla słyszalna głównie z bliska, wygaszana przy zatrzymaniu lub oderwaniu piłki od ziemi. | 2–6 s, pętla | 1 |
| `boot_step_grass_01.mp3` | Pojedynczy krok korkiem po murawie. Wspólny zestaw dla chodu, biegu i kroków bramkarza; tempo oraz głośność dopasowane do ruchu. | 0,10–0,35 s | 3 |
| `boot_scuff_grass_01.mp3` | Krótkie szurnięcie butem po murawie przy zatrzymaniu, obrocie na stopie lub zmianie kierunku. | 0,15–0,60 s | 3 |
| `keeper_land_grass_01.mp3` | Kontakt ciała bramkarza z murawą podczas rzutu: głuchy odgłos lądowania i krótki szelest stroju/trawy. | 0,30–0,90 s | 3 |

Razem z pierwszą sekcją daje to **13 podstawowych plików** w wersji z jednym nagraniem na rodzinę.

## 3. Opcjonalne, ciche efekty

| Nazwa pliku | Zastosowanie | Sugerowana długość | Warianty |
|---|---|---:|---:|
| `calibration_confirm_01.mp3` | Krótkie potwierdzenie prawidłowo przyjętego etapu kalibracji. Ten sam plik może obsługiwać podłogę i pozycję gry. | 0,12–0,35 s | 1 |
| `ui_click_01.mp3` | Bardzo dyskretne potwierdzenie wybrania przycisku menu. | 0,03–0,12 s | 1 |
| `ball_spawn_01.mp3` | Krótkie potwierdzenie przywołania nowej piłki pod B. | 0,08–0,25 s | 1 |
| `ambience_pitch_night_loop.mp3` | Spokojne tło otwartego nocnego boiska: delikatny wiatr i odległy szum otoczenia. | 20–60 s, pętla | 1 |

Z opcjami dodatkowymi lista obejmuje **17 rodzin / 17 plików minimum**.

## Jak przygotować nagrania

- **Nazwy:** małe litery, podkreślenia, bez spacji i polskich znaków. Warianty zdarzeń jednorazowych mają końcówki `_01`, `_02`, `_03`. Pętle mają końcówkę `_loop`.
- **Pojedynczy kontakt na plik.** Początek możliwie blisko właściwego uderzenia, bez długiej ciszy przed nim; zachowaj naturalne wybrzmienie na końcu.
- **Suche brzmienie:** najlepiej bez dodanego pogłosu, panoramowania, muzyki i szumu pomieszczenia. Pogłos oraz odległość będzie można dopasować w grze.
- **Dźwięki fizyczne najlepiej mono.** Ułatwi to późniejsze ustawienie ich w miejscu piłki, buta lub rękawicy. Tło otoczenia może być stereo. Dźwięki menu pozostaną blisko słuchacza.
- **Spójne źródła:** użyj tej samej piłki i podobnej murawy dla pokrewnych efektów. Warianty powinny różnić się wykonaniem, a nie pochodzić z zupełnie innych miejsc.
- **Pętle:** przygotuj fragment, którego koniec płynnie łączy się z początkiem. Końcowe przycięcie i ewentualne przenikanie granic pętli dopasujemy podczas integracji.
- **Propozycja eksportu:** MP3 44,1 lub 48 kHz, około 128–192 kb/s dla krótkich efektów. To wygodne ustawienie robocze, a nie sztywny warunek przyjęcia pliku.

Najbardziej przydatna kolejność przygotowania: **trzy siły kontaktu z piłką → słupek, rękawica i siatka → odbicie od ziemi, kroki i lądowanie bramkarza → pozostałe dodatki**. Nie trzeba osobno nagrywać niskiego tonu i szumowej warstwy obecnego syntezatora — pojedyncze dobre nagranie kontaktu zastąpi cały taki dźwięk.
