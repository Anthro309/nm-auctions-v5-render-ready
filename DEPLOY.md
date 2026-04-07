# Deployment Guide (Render)

## Prerequisites
- GitHub repo connected to Render
- `OPENAI_API_KEY` available

## Option A: Blueprint deploy (recommended)
1. In Render, click **New +** → **Blueprint**.
2. Select this repository.
3. Render reads `render.yaml` and creates the `nm-auctions-v5` web service.
4. Set `OPENAI_API_KEY` in the Render dashboard (Environment tab).
5. Deploy.

## Option B: Manual web service
1. In Render, click **New +** → **Web Service**.
2. Connect this repo.
3. Runtime: **Node**
4. Build command: `npm install`
5. Start command: `node server.js`
6. Add environment variables:
   - `OPENAI_API_KEY` (required for AI features)
   - `PORT=10000` (optional override)
7. Deploy.

## Post-deploy smoke checks
- `GET /` returns login page.
- `POST /login` returns success for known valid user+pin.
- `GET /items` returns JSON array.

## Auto-deploy
- Ensure Render **Auto-Deploy** is enabled so pushes trigger redeploys.
