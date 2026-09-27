# SlopDogs tombstone (integration)

This branch is a **tombstone**. The old dataDogs integration service has been killed and
respawned as **SlopDogs**.

Every URL — visitors and MCP clients alike — answers **410 Gone** and points to the new home:

- New address: https://slopdogs.onrender.com
- New MCP endpoint: https://slopdogs.onrender.com/mcp

It is a single, self-contained Node server (`tombstone.cjs`) with **no dependencies and no build**.

## Run

```
npm start        # node tombstone.cjs, listens on $PORT (default 10000)
```

## Deploy (Render)

- **Build Command:** `npm install` (nothing to build)
- **Start Command:** `npm start`
