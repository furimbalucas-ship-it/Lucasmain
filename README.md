# Itamaracá 3D — Explorador

Explorador 3D interativo da Ilha de Itamaracá (Pernambuco, Brasil), com terreno real, imagens de satélite, edificações do OpenStreetMap e navegação em primeira pessoa.

## Recursos

- **Terreno real** — elevação via Cesium World Terrain
- **Imagens de satélite** — Bing Maps / Ion
- **Edificações 3D** — OpenStreetMap (footprints extrudados)
- **Google Photorealistic 3D** (opcional) — modelo fotorrealista quando disponível
- **Navegação a pé** — WASD, mouse, subir/descer
- **Pontos de interesse** — Forte Orange, Vila, ponte, praias e mais

## Pré-requisitos

1. **Token Cesium Ion** (gratuito): [cesium.com/ion/signup](https://cesium.com/ion/signup)
2. *(Opcional)* **Google Maps API Key** com Map Tiles API para 3D Photorealistic

## Instalação

```bash
npm install
cp .env.example .env
# Edite .env e cole seu VITE_CESIUM_ION_TOKEN
npm run dev
```

Abra `http://localhost:5173`.

## Controles

| Tecla | Ação |
|-------|------|
| W A S D | Mover |
| Shift | Correr |
| Espaço / C | Subir / descer |
| Mouse | Olhar |
| Clique | Capturar cursor |
| Esc | Liberar cursor |

## Google 3D Photorealistic

Para o modelo mais fiel (similar ao Google Earth), adicione no `.env`:

```
VITE_GOOGLE_MAPS_API_KEY=sua_chave_aqui
```

Ative a **Map Tiles API** no Google Cloud Console. A cobertura em Itamaracá depende da disponibilidade regional do Google.

## Stack

- [Vite](https://vitejs.dev/) + TypeScript
- [CesiumJS](https://cesium.com/platform/cesiumjs/)

## Deploy na Vercel

### Opção 1 — Importar do GitHub (recomendado)

1. Acesse [vercel.com/new](https://vercel.com/new) e importe o repositório
2. Em **Environment Variables**, adicione:
   - `VITE_CESIUM_ION_TOKEN` — token gratuito do [Cesium Ion](https://cesium.com/ion/tokens)
   - `VITE_GOOGLE_MAPS_API_KEY` — *(opcional)* para Google 3D Photorealistic
3. Clique em **Deploy**

A Vercel detecta automaticamente o Vite via `vercel.json`.

### Opção 2 — CLI

```bash
npm i -g vercel
vercel login
vercel --prod --build-env VITE_CESIUM_ION_TOKEN=seu_token
```
