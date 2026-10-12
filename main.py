"""Servidor local: Flask + higgsfield-client (z-image/turbo, grok-imagine). Las credenciales nunca salen del servidor."""
import os
import re
import urllib.request
from datetime import datetime
from pathlib import Path

import higgsfield_client
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env.local")
OUT = ROOT / "generated-images"
DIST = ROOT / "web" / "dist"
OUT.mkdir(exist_ok=True)
# Migra imágenes antiguas sueltas a la subcarpeta de z-image
for old in OUT.glob("image-*"):
    (OUT / "z-image").mkdir(exist_ok=True)
    old.rename(OUT / "z-image" / old.name)

RESOLUTIONS = {"1k", "2k"}
MAX_REFS = 5  # la API no documenta un máximo; límite prudente propio
MAX_REF_BYTES = 10 * 1024 * 1024
# Mantener en sync con MODELS en web/src/main.ts
MODELS = {
    "z-image": {
        "id": "z-image/turbo",
        "aspects": {"1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"},
        "seed": True, "prompt_extend": True, "quality": set(), "refs": False,
    },
    "grok": {
        "id": "xai/grok-imagine-image-2.0",
        "aspects": {"auto", "1:1", "1:2", "2:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"},
        "seed": False, "prompt_extend": False, "quality": {"low", "medium"}, "refs": True,
    },
}

app = Flask(__name__)


def error(msg, code=400):
    return jsonify(ok=False, error=msg), code


@app.get("/")
def index():
    return send_from_directory(DIST, "index.html")


@app.get("/assets/<path:p>")
def assets(p):
    return send_from_directory(DIST / "assets", p)


@app.get("/generated-images/<path:p>")
def image(p):
    return send_from_directory(OUT, p)


@app.post("/api/generate")
def generate():
    if not os.getenv("HF_KEY"):
        return error("Falta HF_KEY en .env.local (formato key-id:key-secret).", 500)

    d = request.form
    key = d.get("model", "z-image")
    cfg = MODELS.get(key)
    if not cfg:
        return error("Modelo no válido.")
    prompt = (d.get("prompt") or "").strip()
    if not 1 <= len(prompt) <= 800:
        return error("El prompt debe tener entre 1 y 800 caracteres.")
    args = {
        "prompt": prompt,
        "resolution": d.get("resolution", "1k"),
        "aspect_ratio": d.get("aspect_ratio", "1:1"),
    }
    if args["resolution"] not in RESOLUTIONS or args["aspect_ratio"] not in cfg["aspects"]:
        return error("Resolución o relación de aspecto no válida.")
    if cfg["prompt_extend"]:
        args["prompt_extend"] = d.get("prompt_extend") in ("true", "1", "on")
    if cfg["quality"]:
        args["quality"] = d.get("quality", "medium")
        if args["quality"] not in cfg["quality"]:
            return error("Calidad no válida.")
    files = request.files.getlist("images")
    if files and not cfg["refs"]:
        return error("Este modelo no admite imágenes de referencia.")
    if len(files) > MAX_REFS:
        return error(f"Máximo {MAX_REFS} imágenes de referencia.")
    if cfg["seed"] and d.get("seed") not in (None, ""):
        try:
            seed = int(d["seed"])
        except (TypeError, ValueError):
            return error("La seed debe ser un entero.")
        if not 0 <= seed <= 2147483647:
            return error("La seed debe estar entre 0 y 2147483647.")
        args["seed"] = seed

    if files:
        urls = []
        try:
            for f in files:
                ctype = f.mimetype or ""
                data = f.read()
                if not ctype.startswith("image/"):
                    return error(f"«{f.filename}» no es una imagen.")
                if len(data) > MAX_REF_BYTES:
                    return error(f"«{f.filename}» supera los 10 MB.")
                urls.append(higgsfield_client.upload(data, ctype))
        except Exception as e:
            return error(f"No se pudo subir la imagen de referencia: {e}", 502)
        args["image_urls"] = urls

    last = {}
    try:
        result = higgsfield_client.subscribe(
            cfg["id"], arguments=args, on_queue_update=lambda s: last.update(status=s)
        )
    except Exception as e:  # HiggsfieldClientError, red, credenciales...
        return error(f"Error de la API: {e}", 502)

    status = last.get("status")
    if isinstance(status, higgsfield_client.NSFW):
        return error("Solicitud moderada (NSFW): no se generó imagen.", 422)
    if isinstance(status, higgsfield_client.Cancelled):
        return error("La solicitud fue cancelada: no se generó imagen.", 409)
    if isinstance(status, higgsfield_client.Failed):
        return error("La generación falló: no se generó imagen.", 502)
    if not isinstance(status, higgsfield_client.Completed):
        return error("La solicitud no terminó correctamente.", 502)

    images = (result or {}).get("images") or []
    url = images[0].get("url") if images else None
    if not url:
        return error(f"La API completó la solicitud pero no devolvió imagen: {result}", 502)

    ext = Path(url.split("?")[0]).suffix or ".png"
    name = f"image-{datetime.now():%Y-%m-%d-%H-%M-%S}{ext}"
    folder = OUT / key
    folder.mkdir(exist_ok=True)
    try:
        urllib.request.urlretrieve(url, folder / name)
    except Exception as e:
        return error(f"Se generó la imagen pero falló la descarga ({e}). URL: {url}", 502)
    return jsonify(ok=True, file=f"{key}/{name}", url=f"/generated-images/{key}/{name}")


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)
