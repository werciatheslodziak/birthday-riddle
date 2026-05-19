import { STORAGE_KEYS } from "./config.js";
import { els } from "./state.js";

const STEPS = [
  {
    title: "Przeciągnij klocek",
    body: "Z tacki lub strefy roboczej przenieś element na planszę. Luźny możesz zostawić na planszy.",
  },
  {
    title: "Obróć, jeśli trzeba",
    body: "Na komputerze: R, prawy przycisk na klocku albo LPM+PPM podczas przeciągania. Na telefonie: wybierz klocek, potem krótki drugi tap.",
  },
  {
    title: "Zielono = puść",
    body: "Gdy podpowiedź jest zielona i klocek ma 0°, puszczenie przyczepi go automatycznie.",
  },
];

let stepIndex = 0;

function renderStep() {
  if (!els.tutorialOverlay) return;
  const step = STEPS[stepIndex];
  const title = els.tutorialOverlay.querySelector(".tutorial-title");
  const body = els.tutorialOverlay.querySelector(".tutorial-body");
  const progress = els.tutorialOverlay.querySelector(".tutorial-progress");
  if (title) title.textContent = step.title;
  if (body) body.textContent = step.body;
  if (progress) progress.textContent = `${stepIndex + 1} / ${STEPS.length}`;
}

export function maybeShowTutorial() {
  if (!els.tutorialOverlay) return;
  try {
    if (localStorage.getItem(STORAGE_KEYS.tutorialSeen) === "1") return;
  } catch {
    return;
  }
  stepIndex = 0;
  renderStep();
  els.tutorialOverlay.classList.remove("hidden");
}

export function installTutorial() {
  if (!els.tutorialOverlay) return;

  els.tutorialNext?.addEventListener("click", () => {
    if (stepIndex < STEPS.length - 1) {
      stepIndex += 1;
      renderStep();
      return;
    }
    dismissTutorial();
  });

  els.tutorialSkip?.addEventListener("click", dismissTutorial);

  els.tutorialOverlay.addEventListener("click", (ev) => {
    if (ev.target === els.tutorialOverlay) dismissTutorial();
  });
}

function dismissTutorial() {
  try {
    localStorage.setItem(STORAGE_KEYS.tutorialSeen, "1");
  } catch {
  }
  els.tutorialOverlay?.classList.add("hidden");
}
