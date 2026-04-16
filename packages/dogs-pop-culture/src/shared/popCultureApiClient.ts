export async function popCultureFetch<T>(url: string, timeoutMs: number = 20000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
        res = await fetch(url, {
            headers: { "Accept": "application/json", "User-Agent": "dataDogs/0.1" },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`pop-culture fetch failed (${url}): ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}
