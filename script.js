// Steuerung: Pfeiltasten / Leertaste / Bild-Tasten, F = Vollbild, Home/End = Anfang/Ende
const slides = [...document.querySelectorAll(".slide")];
const barLeft = document.getElementById("bar-left");
const barRight = document.getElementById("bar-right");
const hudLeft = document.getElementById("hud-left");
const hudRight = document.getElementById("hud-right");
const counter = document.getElementById("counter");

let cur = 0;   // aktuelle Folie
let step = 0;  // Schritt innerhalb der Folie (Duell-Runden, Quiz-Auflösung)

const maxStep = (s) => Number(s.dataset.steps || 0);

function render() {
  slides.forEach((s, i) => {
    s.classList.toggle("active", i === cur);
    s.classList.toggle("past", i < cur);
  });

  const s = slides[cur];
  s.dataset.step = step;
  s.querySelectorAll("[data-only]").forEach((el) =>
    el.classList.toggle("on", Number(el.dataset.only) === step));

  // Lebensbalken: Wert der aktuellen Runde, sonst voll
  const hpEl = s.querySelector(`[data-only="${step}"][data-hp]`);
  const [l, r] = hpEl ? hpEl.dataset.hp.split(",") : [100, 100];
  barLeft.style.width = l + "%";
  barRight.style.width = r + "%";

  // Wer steht gerade im Fokus?
  const focus = s.dataset.focus;
  hudLeft.classList.toggle("active", focus === "left" || focus === "both");
  hudRight.classList.toggle("active", focus === "right" || focus === "both");

  counter.textContent = `${cur + 1} / ${slides.length}`;
  history.replaceState(null, "", "#" + (cur + 1));
}

function next() {
  if (step < maxStep(slides[cur])) step++;
  else if (cur < slides.length - 1) { cur++; step = 0; }
  render();
}

function prev() {
  if (step > 0) step--;
  else if (cur > 0) { cur--; step = maxStep(slides[cur]); }
  render();
}

document.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowRight": case "ArrowDown": case "PageDown": case " ": case "Enter":
      e.preventDefault(); next(); break;
    case "ArrowLeft": case "ArrowUp": case "PageUp": case "Backspace":
      e.preventDefault(); prev(); break;
    case "Home": cur = 0; step = 0; render(); break;
    case "End": cur = slides.length - 1; step = 0; render(); break;
    case "f": case "F":
      document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      break;
  }
});

// Quiz: Klick auf eine Antwort löst auf
document.querySelectorAll(".quiz .opt").forEach((btn) =>
  btn.addEventListener("click", () => { step = 1; render(); btn.blur(); }));

document.getElementById("btn-next").addEventListener("click", (e) => { next(); e.target.blur(); });
document.getElementById("btn-prev").addEventListener("click", (e) => { prev(); e.target.blur(); });

// Startfolie aus URL (#3 = Folie 3)
const start = parseInt(location.hash.slice(1), 10);
if (start >= 1 && start <= slides.length) cur = start - 1;
render();
