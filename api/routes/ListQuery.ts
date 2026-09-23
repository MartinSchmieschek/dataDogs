// ListQuery — the sieve laid over a list route: ownership, search, order, page.
//
// The reduction runs in JS over the result of listLatest(), NOT in SQL. With 261 kennels
// that is cheap, and an SQL variant would have to touch both the lineage reduction and the
// ACL filtering, which each live in JS. This is a deliberate intermediate step, not an end
// state: the next step is to push the reduction down into the query itself.
//
// Order of operations is fixed and must not be reordered:
//   ACL visibility (the caller applies it BEFORE handing the list in)
//     -> mine -> q -> sort -> offset/limit
// `total` counts after `mine` and `q`, before the page is cut. Slicing earlier yields
// wrong pages; counting before the ACL filter would leak how many private entries of
// other users exist.

import type { AuthCtx } from '../../mcp/auth/middleware';

export type SortField = 'name' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface IListPage<T> {
    data: T[];
    total: number;
}

export class ListQuery {
    /** Hard ceiling — a caller may ask for more, but never receives more. */
    static readonly MAX_LIMIT = 200;

    private static readonly SORT_FIELDS: readonly string[] = ['name', 'createdAt', 'updatedAt'];
    private static readonly SEARCHABLE_FIELDS: readonly string[] = ['name', 'displayName', 'description'];

    private constructor(
        readonly limit: number | null,
        readonly offset: number,
        readonly search: string,
        readonly sort: SortField,
        readonly dir: SortDirection,
        readonly mineOnly: boolean,
    ) { }

    /**
     * Read the query string. Every parameter is optional, and a broken value never raises —
     * it falls back to its default or is pulled to the ceiling. A mangled URL must not 500.
     */
    static from(query: Record<string, unknown> | undefined): ListQuery {
        const q = query ?? {};
        return new ListQuery(
            ListQuery.parseLimit(q.limit),
            ListQuery.parseOffset(q.offset),
            ListQuery.parseText(q.q),
            ListQuery.parseSort(q.sort),
            ListQuery.parseDirection(q.dir),
            ListQuery.parseFlag(q.mine),
        );
    }

    /** True only when `limit` was given — only then does the response envelope grow. */
    get isPaged(): boolean {
        return this.limit !== null;
    }

    /** Apply mine -> q -> sort -> page. The caller has already applied the ACL filter. */
    apply<T>(items: T[], ctx: AuthCtx | undefined): IListPage<T> {
        const owned = this.mineOnly ? items.filter(item => ListQuery.isOwnedBy(item, ctx)) : items;
        const found = this.search ? owned.filter(item => this.matches(item)) : owned;
        const ordered = this.ordered(found);

        if (this.limit === null) {
            return { data: ordered, total: ordered.length };
        }
        return { data: ordered.slice(this.offset, this.offset + this.limit), total: ordered.length };
    }

    /**
     * The response body. Without `limit` it is byte-for-byte what this route always returned —
     * that is the standing promise to MCP and every existing caller.
     */
    envelope<T>(page: IListPage<T>): Record<string, unknown> {
        if (!this.isPaged) {
            return { ok: true, data: page.data };
        }
        return { ok: true, data: page.data, total: page.total, limit: this.limit, offset: this.offset };
    }

    /** Ownership uses the one notion the code already has: the `ownerId` column. */
    private static isOwnedBy(item: unknown, ctx: AuthCtx | undefined): boolean {
        // Nobody is logged in — an anonymous caller owns nothing, so `mine=1` yields nothing.
        const userId = ctx?.user?.id;
        if (!userId) return false;
        return (item as { ownerId?: string | null })?.ownerId === userId;
    }

    private matches(item: unknown): boolean {
        const record = item as Record<string, unknown>;
        return ListQuery.SEARCHABLE_FIELDS.some(field => {
            const value = record?.[field];
            return typeof value === 'string' && value.toLowerCase().includes(this.search);
        });
    }

    /**
     * Stable order: on a tie we fall back to `id`, otherwise entries drift between pages
     * and a reader sees the same row twice while another is never shown.
     */
    private ordered<T>(items: T[]): T[] {
        const sign = this.dir === 'desc' ? -1 : 1;
        return [...items].sort((a, b) => {
            const primary = ListQuery.compare(ListQuery.sortValue(a, this.sort), ListQuery.sortValue(b, this.sort));
            const tie = ListQuery.compare(ListQuery.idOf(a), ListQuery.idOf(b));
            return sign * (primary !== 0 ? primary : tie);
        });
    }

    private static compare(a: string | number, b: string | number): number {
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
    }

    private static idOf(item: unknown): string {
        return String((item as { id?: unknown })?.id ?? '');
    }

    private static sortValue(item: unknown, field: SortField): string | number {
        const record = item as Record<string, unknown>;
        if (field === 'name') {
            // Kennels carry `name`, dogs carry `displayName` — one route serves both.
            const label = record?.name ?? record?.displayName ?? '';
            return String(label).toLowerCase();
        }
        // AbstractController.listLatest parks the row timestamp on `_createdAt`; KennelController
        // hands out real `createdAt` / `updatedAt`. Fall back rather than sort everything to 0.
        const raw = field === 'updatedAt'
            ? record?.updatedAt ?? record?.createdAt ?? record?._createdAt
            : record?.createdAt ?? record?._createdAt;
        const time = raw ? new Date(raw as string).getTime() : 0;
        return Number.isFinite(time) ? time : 0;
    }

    private static parseLimit(raw: unknown): number | null {
        if (raw === undefined || raw === null || raw === '') return null;
        const value = Number(ListQuery.first(raw));
        // Not a number or not positive -> behave as if no limit had been given at all.
        if (!Number.isFinite(value) || value < 1) return null;
        return Math.min(Math.floor(value), ListQuery.MAX_LIMIT);
    }

    private static parseOffset(raw: unknown): number {
        const value = Number(ListQuery.first(raw));
        if (!Number.isFinite(value) || value < 0) return 0;
        return Math.floor(value);
    }

    private static parseText(raw: unknown): string {
        const value = ListQuery.first(raw);
        return typeof value === 'string' ? value.trim().toLowerCase() : '';
    }

    private static parseSort(raw: unknown): SortField {
        const value = ListQuery.first(raw);
        return ListQuery.SORT_FIELDS.includes(value as string) ? (value as SortField) : 'name';
    }

    private static parseDirection(raw: unknown): SortDirection {
        return ListQuery.first(raw) === 'desc' ? 'desc' : 'asc';
    }

    private static parseFlag(raw: unknown): boolean {
        const value = ListQuery.first(raw);
        return value === '1' || value === 'true';
    }

    /** Express hands repeated query parameters over as arrays — take the first, ignore the rest. */
    private static first(raw: unknown): unknown {
        return Array.isArray(raw) ? raw[0] : raw;
    }
}
