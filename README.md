# Cheeta Image Generator Studio

Estudio web local para generar imágenes con los modelos de [Higgsfield](https://higgsfield.ai). Un servidor Flask sirve la interfaz y hace de intermediario con la API, de modo que tu clave nunca llega al navegador.

## Modelos

| Modelo | ID en Higgsfield | Opciones |
| --- | --- | --- |
| Z-Image Turbo | `z-image/turbo` | Resolución 1K/2K, 10 formatos, seed, mejora de prompt |
| Grok Imagine 2.0 | `xai/grok-imagine-image-2.0` | Calidad baja/media, resolución 1K/2K, formato `auto` y 9 más, hasta 5 imágenes de referencia |

## Características

- Selector de modelo; los controles cambian según lo que admite cada uno.
- Imágenes de referencia para Grok (se suben a Higgsfield y se envían como `image_urls`).
- Los resultados se guardan en `generated-images/<modelo>/` (`z-image/`, `grok/`).
- Errores explícitos: contenido moderado (NSFW), cancelado, fallido o sin imagen.
- Historial de la sesión, descarga y apertura de cada imagen.
- Interfaz en español, tema oscuro.

## Stack

- **Backend:** Python, [Flask](https://flask.palletsprojects.com/), [`higgsfield-client`](https://pypi.org/project/higgsfield-client/), `python-dotenv`
- **Frontend:** TypeScript + [Vite](https://vite.dev/), sin framework de UI; CSS en línea; tipografías Geist y Bricolage Grotesque (`@fontsource-variable`)

## Requisitos

- Python 3.10+
- Node.js 18+
- Una clave de API de Higgsfield (`key-id:key-secret`)

## Instalación

```bash
# Backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Frontend
cd web
npm install
npm run build
```

Crea un archivo `.env.local` en la raíz con tu clave:

```
HF_KEY=key-id:key-secret
```

## Uso

```bash
.venv/bin/python main.py
```

Abre <http://127.0.0.1:5000>. Flask sirve el frontend **compilado** (`web/dist`), así que tras cambiar algo en `web/` ejecuta `npm run build` (o `npm run dev` para recompilar en modo watch). Si cambias `.env.local`, reinicia el servidor.

## Estructura

```
main.py              Servidor Flask y ruta POST /api/generate
web/index.html       Página única (CSS en línea)
web/src/main.ts      Lógica de la interfaz
generated-images/    Resultados, una subcarpeta por modelo (ignorada por git)
PRODUCT.md           Principios de producto y diseño
```

Para añadir un modelo, agrégalo a `MODELS` en `main.py` y en `web/src/main.ts`, y ajusta las opciones del formulario en `web/index.html`.

## Notas

- Es una herramienta local de un solo usuario: no tiene autenticación y escucha solo en `127.0.0.1`.
- **Cada generación consume créditos de Higgsfield.**
- `.env.local`, `generated-images/`, `.venv/`, `node_modules/` y `web/dist/` están en `.gitignore`.

---

By StoicDev90
