import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/bricolage-grotesque";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// Mantener en sync con MODELS en main.py
const MODELS = {
  "z-image": { aspects: ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"], seed: true, extend: true, quality: false, refs: false },
  grok: { aspects: ["auto", "1:1", "1:2", "2:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"], seed: false, extend: false, quality: true, refs: true },
};
type ModelKey = keyof typeof MODELS;
const MAX_REFS = 5;
const frame = $("frame");
const msg = $("msg");
const go = $<HTMLButtonElement>("go");
const promptEl = $<HTMLTextAreaElement>("prompt");
const seedEl = $<HTMLInputElement>("seed");

interface GenResponse { ok: boolean; error?: string; file?: string; url?: string }
interface Shot { file: string; url: string }

function setRatio(w: number, h: number) {
  frame.style.setProperty("--ar", `${w} / ${h}`);
  frame.style.setProperty("--arn", String(w / h));
}

const ratios = $("ratios");
const checkedVal = (name: string) => document.querySelector<HTMLInputElement>(`input[name=${name}]:checked`)!.value;
const model = () => checkedVal("model") as ModelKey;

// Aspect-ratio chips: each draws its own proportions.
function renderRatios() {
  const prev = ratios.querySelector<HTMLInputElement>("input:checked")?.value;
  const list = MODELS[model()].aspects;
  const sel = prev && list.includes(prev) ? prev : list[0];
  ratios.querySelectorAll("input, label").forEach((n) => n.remove());
  ratios.insertAdjacentHTML(
    "beforeend",
    list.map((a, i) => {
      const [w, h] = a === "auto" ? [1, 1] : a.split(":").map(Number);
      const k = 18 / Math.max(w, h);
      const shape = a === "auto" ? `<i style="width:18px;height:18px;border-style:dashed"></i>` : `<i style="width:${Math.round(w * k)}px;height:${Math.round(h * k)}px"></i>`;
      return `<input type="radio" name="aspect" id="a${i}" value="${a}"${a === sel ? " checked" : ""}>` +
        `<label for="a${i}">${shape}${a}</label>`;
    }).join(""),
  );
  syncFrame();
}
function syncFrame() {
  const v = checkedVal("aspect");
  if (v === "auto") return setRatio(1, 1);
  const [w, h] = v.split(":").map(Number);
  if (!frame.querySelector("img")) setRatio(w, h);
}
ratios.addEventListener("change", syncFrame);

// Reference images (Grok only)
const refs: File[] = [];
const refsEl = $("refs");
const refFile = $<HTMLInputElement>("reffile");
function renderRefs() {
  refsEl.replaceChildren();
  refs.forEach((f, i) => {
    const t = document.createElement("div");
    t.className = "thumb";
    const img = new Image();
    img.alt = f.name;
    img.src = URL.createObjectURL(f);
    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "×";
    x.setAttribute("aria-label", `Quitar ${f.name}`);
    x.addEventListener("click", () => { refs.splice(i, 1); renderRefs(); });
    t.append(img, x);
    refsEl.append(t);
  });
  if (refs.length < MAX_REFS) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "add";
    add.textContent = "+";
    add.setAttribute("aria-label", "Añadir imagen de referencia");
    add.addEventListener("click", () => refFile.click());
    refsEl.append(add);
  }
}
refFile.addEventListener("change", () => {
  refs.push(...Array.from(refFile.files ?? []).filter((f) => f.type.startsWith("image/")));
  refs.length = Math.min(refs.length, MAX_REFS);
  refFile.value = "";
  renderRefs();
});

function applyModel() {
  const m = MODELS[model()];
  $("seedf").hidden = !m.seed;
  $("extendf").hidden = !m.extend;
  $("quality").hidden = !m.quality;
  $("reff").hidden = !m.refs;
  renderRatios();
}
document.querySelectorAll("input[name=model]").forEach((r) => r.addEventListener("change", applyModel));
renderRefs();
applyModel();

promptEl.addEventListener("input", () => ($("count").textContent = `${promptEl.value.length}/800`));
promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) $<HTMLFormElement>("f").requestSubmit();
});
$("dice").addEventListener("click", () => (seedEl.value = String(Math.floor(Math.random() * 2147483648))));

// Session strip
const strip = $("strip");
const shots: Shot[] = [];

function show(shot: Shot) {
  const img = new Image();
  img.alt = "Imagen generada";
  img.onload = () => setRatio(img.naturalWidth, img.naturalHeight);
  img.src = shot.url;
  frame.replaceChildren(img);
  $("fname").textContent = shot.file;
  $<HTMLAnchorElement>("dl").href = shot.url;
  $<HTMLAnchorElement>("dl").download = shot.file;
  $<HTMLAnchorElement>("open").href = shot.url;
  $("meta").hidden = false;
  strip.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.setAttribute("aria-current", String(b.dataset.file === shot.file)));
}

function addShot(shot: Shot) {
  shots.unshift(shot);
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.file = shot.file;
  b.title = shot.file;
  b.innerHTML = `<img src="${shot.url}" alt="${shot.file}">`;
  b.addEventListener("click", () => show(shot));
  strip.prepend(b);
  strip.hidden = false;
}

function failure(text: string) {
  frame.innerHTML = `<div class="fail" role="alert"><h2>No se generó la imagen</h2><p></p></div>`;
  frame.querySelector("p")!.textContent = text;
  $("meta").hidden = true;
  msg.className = "";
  msg.textContent = "";
}

$<HTMLFormElement>("f").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!promptEl.value.trim()) {
    promptEl.focus();
    return failure("Escribe un prompt antes de generar.");
  }
  go.disabled = true;
  go.textContent = "Generando…";
  $("meta").hidden = true;
  msg.className = "";
  msg.textContent = "";

  const t0 = Date.now();
  frame.innerHTML = `<div class="skeleton"><b id="timer">0 s</b><span>Esperando a Higgsfield</span></div>`;
  const timer = setInterval(() => {
    const t = document.getElementById("timer");
    if (t) t.textContent = `${Math.floor((Date.now() - t0) / 1000)} s`;
  }, 500);

  try {
    const m = MODELS[model()];
    const fd = new FormData();
    fd.set("model", model());
    fd.set("prompt", promptEl.value);
    fd.set("resolution", checkedVal("resolution"));
    fd.set("aspect_ratio", checkedVal("aspect"));
    if (m.seed) fd.set("seed", seedEl.value);
    if (m.extend) fd.set("prompt_extend", String($<HTMLInputElement>("extend").checked));
    if (m.quality) fd.set("quality", checkedVal("quality"));
    if (m.refs) refs.forEach((f) => fd.append("images", f));
    const res = await fetch("/api/generate", { method: "POST", body: fd });
    const data: GenResponse = await res.json();
    if (!data.ok) throw new Error(data.error ?? "Error desconocido.");
    const shot = { file: data.file!, url: data.url! };
    addShot(shot);
    show(shot);
    msg.className = "ok";
    msg.textContent = `Guardada en generated-images/${shot.file}`;
  } catch (err) {
    failure((err as Error).message);
  } finally {
    clearInterval(timer);
    go.disabled = false;
    go.textContent = "Generar imagen";
  }
});
