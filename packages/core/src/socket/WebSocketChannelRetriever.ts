/**
 * ============================================================
 *  WEBSOCKET CHANNEL RETRIEVER — der Pfoertner der Lobby
 * ============================================================
 *  Liest die Channel-Id aus dem QueryRetriever (oder erzeugt
 *  eine frische, wenn keine kam), meldet den Channel beim Hub
 *  an und liefert einen Snapshot des aktuellen Stands:
 *  Teilnehmer + ihre shared-Objekte + Wege zur Live-Verbindung.
 *
 *  Der eigentliche Echtzeit-Verkehr laueft NICHT durch diesen
 *  Hund — der ist der Begruessungs-Schreiberling. WebSockets
 *  uebernimmt der Hub.
 * ============================================================
 */

import { Dog } from "../core/entities/abstractHuntingDog";
import { IHuntingDog } from "../core/entities/IHuntingDog";
import { IHuntingSeason } from "../core/entities/IHuntingSeason";
import { QueryRetriever } from "../platform/QueryRetriever";
import type { ChannelState, IChannelHub } from "./IChannelHub";

export class WebSocketChannelRetriever extends Dog<ChannelState> {
    private static hub: IChannelHub | undefined;

    /** Vom Server (main.ts) vor der Hunde-Schmiede einmal gerufen. */
    static initService(hub: IChannelHub): void {
        WebSocketChannelRetriever.hub = hub;
    }

    constructor() {
        super();
        if (!WebSocketChannelRetriever.hub) {
            throw new Error(
                "WebSocketChannelRetriever: hub not initialised — WebSocketChannelRetriever.initService(hub) muss vor `new WebSocketChannelRetriever()` aufgerufen werden.",
            );
        }
    }

    get name(): string {
        return WebSocketChannelRetriever.name;
    }

    get description(): string {
        return "Lobby-Pfoertner: legt Lobby an oder tritt einer bei (channelId aus Query). Liefert shareUrl, wsUrl und aktuelle Teilnehmer mit shared-Objekten.";
    }

    get icon(): string | undefined {
        return "\uD83D\uDEAA";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [QueryRetriever];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<ChannelState> => {
        const hub = WebSocketChannelRetriever.hub!;

        // Channel-Id aus QueryRetriever lesen (bereits lowercased durch QueryRetriever).
        const queryDog = season.exhausted.find(d => d.name === QueryRetriever.name);
        const query = (queryDog?.collected ?? {}) as Record<string, string>;
        const incomingId = (query["channelid"] ?? "").trim();

        const channelId = incomingId || hub.newChannelId();
        const join = hub.joinOrCreate(channelId);

        // wsUrl: absolut wenn PUBLIC_API_BASE_URL gesetzt ist, sonst relativ (Client setzt
        // Protokoll/Host aus location davor). Der WS-Pfad wird ueber WS_PATH konfiguriert
        // (Default in ChannelHub: /api/channels) — wir spiegeln den hier per ENV.
        const wsPath = (process.env.WS_PATH || "/api/channels").replace(/\/$/, "") || "/api/channels";
        const publicBase = (process.env.PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
        const wsUrl = publicBase
            ? publicBase.replace(/^http/, "ws") + `${wsPath}?channelId=${encodeURIComponent(channelId)}`
            : `${wsPath}?channelId=${encodeURIComponent(channelId)}`;

        return {
            channelId,
            created: join.created,
            wsUrl,
            peers: join.peers,
            heartbeatSec: hub.heartbeatSec(),
        };
    };
}
