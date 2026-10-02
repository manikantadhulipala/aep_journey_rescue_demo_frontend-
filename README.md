# aep_journey_rescue_demo_frontend- — Journey Rescue UI

React, TypeScript, and Vite user interface for the Journey Rescue demo.

## Run

Start the backend API on port 4000 first (instructions in
[`../backend/README.md`](../backend/README.md)), then from this directory:

```sh
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` requests to
`http://localhost:4000`. For a production deployment, serve the built frontend
and configure the API origin through the hosting platform/reverse proxy.

## Pages

- Overview and live audience size.
- Audience-rule builder with date and lookback controls.
- Offline demo rule assistant and a count-only, simulated activation workflow.
- Searchable profiles and profile/event inspection.
- Unified journey event stream.
- Data-source, identity, and XDM mapping guide.

The app expects the synthetic-data backend; it does not connect to Adobe
Experience Platform directly. Keep OAuth credentials server-side.

See [INTERVIEW_GUIDE.md](./INTERVIEW_GUIDE.md) for a system-design question and
a truthful project walkthrough tailored to a CDP / Audience Builder role.
