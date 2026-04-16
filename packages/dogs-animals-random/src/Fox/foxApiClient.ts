import type { FoxApiResponse, FoxResult } from "./interfaces/foxTypes";

const FOX_BASE = "https://randomfox.ca/floof/";

export async function getRandomFox(): Promise<FoxResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
        res = await fetch(FOX_BASE, {
            headers: { "Accept": "application/json", "User-Agent": "dataDogs/0.1" },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`randomfox.ca failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const data = await res.json() as FoxApiResponse;
    return { imageUrl: data.image, pageUrl: data.link };
}
