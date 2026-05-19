export const STATUS = {
  imageLoadFailed: "Nie udało się wczytać obrazka. Wybierz inny plik.",
  initialHint: (wideViewport) =>
    wideViewport
      ? "Przeciągnij element na planszę — luźny możesz zostawić na planszy. Obrót: R, prawy przycisk na klocku albo LPM+PPM podczas przeciągania (+90°)."
      : "Przeciągnij element na planszę — luźny możesz zostawić na planszy. Obrót: drugi krótki tap na ten sam wybrany klocek (+90°).",
  rotationAligned: "Dobrze ustawiona rotacja. Teraz znajdź miejsce.",
  rotationDegrees: (deg) => `Obrót: ${deg}°. Ustaw na 0°, żeby zatrzasnąć.`,
  pieceSelected: (wideViewport) =>
    wideViewport
      ? "Klocek wybrany — obrót: R, prawy przycisk albo LPM+PPM podczas przeciągania (+90°)."
      : "Klocek wybrany — stuknij go jeszcze raz krótko, żeby obrócić o 90°.",
  dropOutsideBoard: "Klocek poza planszą — wraca do tacki. Upuść na planszę, żeby go tam zostawić.",
  stayedOnBoard: "Klocek zostaje na planszy w tym miejscu.",
  buildingPuzzle: "Układanie puzzli…",
  wrongRotation:
    "To jest właściwe miejsce, ale klocek jest obrócony. Obróć go do 0° albo dokończ na planszy.",
  notRightSpot:
    "Blisko, ale nie to miejsce. Spróbuj przesunąć dokładniej albo zostaw klocek na planszy jako luźny.",
  snapped: (placed, total) => `Zatrzaśnięte! ${placed} / ${total}`,
  shuffled: "Luźne elementy wymieszane.",
  finished: "Wszystkie elementy ułożone. Prezent ukończony!",
  buildBefore3d: "Najpierw wygeneruj puzzle, potem wyeksportuj plik 3D.",
  buildBefore2d: "Najpierw wygeneruj puzzle, potem wydrukuj szablon.",
  popupBlocked3d:
    "Przeglądarka zablokowała widok 3D. Zezwól na wyskakujące okna i spróbuj ponownie.",
  popupBlocked2d:
    "Przeglądarka zablokowała okno wydruku. Zezwól na wyskakujące okna i spróbuj ponownie.",
  template3dReady: "Otworzono widok druku 3D z podglądem i instrukcją.",
  printExportDisabled:
    "Szablon 2D i eksport 3D są wyłączone przy układance 500 i 1000 elementów. Wybierz mniejszą siatkę.",
  printExportDisabledTitle:
    "Niedostępne przy 500 i 1000 elementach — wybierz mniejszą układankę.",
  template2dReady: "Szablon do druku otwarty w nowej karcie.",
  template2dRendering: "Generuję szablon do druku, daj chwilę…",
  template3dRendering: "Składam model 3D, daj chwilę…",
  saveBusy: "Puść najpierw klocek nad planszą albo tacą.",
  saveSuccess: (when) =>
    `Postęp zapisany (${when}). Zapis jest trzymany lokalnie w tej przeglądarce — zniknie przy wyczyszczeniu danych strony.`,
  saveFailed:
    "Za duży rozmiar zapisu lub brak miejsca. Spróbuj mniejszego zdjęcia JPG albo mniejszej liczby elementów.",
  loadEmpty: "Nie znaleziono zapisanego postępu w tej przeglądarce.",
  loadCorrupt: "Zapis jest uszkodzony. Nie da się wczytać stanu.",
  loadUnsupported: "Nieobsługiwany format zapisu.",
  loadBeforeGame: "Wczytaj zapis po otwarciu prezentu i wejściu do gry.",
  loadSuccess: (dims) => `Wczytano zapis (${dims}).`,
  loadHeavyViewportFallback: (wanted, dimsApplied) =>
    `Wczytano zapis przy węższym oknie: zapis był dla ${wanted} klocków, ustawiłem siatkę ${dimsApplied}. Układ został złożony na nowo pod mniejszą planszę.`,
  desktopHeavyRebuildMin: (minPieces) =>
    `Szerokość okna jest za mała dla trybu od ${minPieces} elementów — przełączono na mniejszą siatkę; luźne klocki ułożyłem od nowa.`,
  mobileMaxPiecesClamp: (max) => {
    const m = Math.floor(Number(max));
    const root = Math.sqrt(m);
    const gridSuffix = Number.isInteger(root) ? ` (${root}×${root})` : "";
    return `Na telefonie dostępne są układanki do ${m} elementów${gridSuffix}. Zapis dotyczył większej siatki — zacznij od nowa lub wczytaj inny zapis.`;
  },
};

export const VIEW_3D = {
  pageTitle: "Druk 3D puzzli",
  heading: "Podgląd i przygotowanie druku 3D",
  intro:
    "To jest wizualizacja płaskich elementów puzzli w pliku STL. Model nie zawiera zdjęcia, tylko kształty puzzli do wydruku jako baza albo wykrojnik.",
  download: "Pobierz STL",
  close: "Zamknij",
  ariaPreview: "Wizualizacja puzzli 3D",
  grid: (cols, rows) => `${cols} × ${rows}`,
  count: (n) => `${n} elementów`,
  thickness: "ok. 2 mm grubości",
  sections: [
    {
      title: "Co dostajesz",
      items: [
        "Jeden plik STL z elementami rozłożonymi z odstępami.",
        "Wypustki i wcięcia takie same jak w aktualnej układance.",
        "Płaskie elementy o grubości około 2 mm.",
      ],
      ordered: false,
    },
    {
      title: "Co jest potrzebne",
      items: [
        "Drukarka 3D FDM albo żywiczna.",
        "Slicer, np. PrusaSlicer, Cura albo Bambu Studio.",
        "Filament PLA/PETG albo żywica.",
        "Osobno wydrukowane zdjęcie, klej w sprayu / taśma dwustronna i opcjonalnie laminat.",
      ],
      ordered: false,
    },
    {
      title: "Jak drukować",
      items: [
        "Pobierz STL i otwórz go w slicerze.",
        "Jednostki traktuj jako milimetry. Domyślna szerokość całości to około 180 mm.",
        "Drukuj płasko na stole, bez supportów.",
        "Dla FDM warstwa 0.16–0.2 mm i 15–25% infill albo pełne top/bottom layers.",
        "Jeśli chcesz większe puzzle, przeskaluj model w slicerze przed cięciem.",
      ],
      ordered: true,
    },
    {
      title: "Jak złożyć ze zdjęciem",
      items: [
        "Wydrukuj zdjęcie albo szablon 2D z aplikacji.",
        "Naklej zdjęcie na wydrukowane elementy lub na cienką planszę przed wycięciem.",
        "Najczyściej wyjdzie, jeśli zdjęcie ma lekki zapas na krawędziach.",
        "Po sklejeniu przytnij krawędzie nożykiem, a potem sprawdź spasowanie elementów.",
      ],
      ordered: true,
    },
  ],
};

export const VIEW_2D = {
  pageTitle: "Szablon cięcia puzzli",
  heading: (cols, rows) => `Szablon cięcia puzzli ${cols} × ${rows}`,
  note:
    "Każdy element jest osobno i ma zapas zdjęcia wokół linii cięcia, żeby przy ręcznym wycinaniu nie zostawały białe krawędzie. Tnij po ciemnej linii: kształty wypustek i wcięć są takie same jak w aktualnej układance.",
  print: "Drukuj",
  close: "Zamknij",
  ariaSvg: "Szablon cięcia puzzli z odstępami",
};
