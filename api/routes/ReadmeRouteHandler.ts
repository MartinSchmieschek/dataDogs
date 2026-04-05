// The ReadmeRouteHandler — keeper of the sacred scrolls.
// For those who seek the truth, the README awaits in luminous plain text.
import fs from 'fs';
import path from 'path';

export class ReadmeRouteHandler {
    private readmePath: string;

    constructor(rootDir: string) {
        this.readmePath = path.join(rootDir, 'README.md');
    }

    registerRoutes(app: any): void {
        app.get('/api/readme', (_req: any, res: any) => this.handleGet(_req, res));
    }

    // GET /api/readme — the project's README, rendered as plain text for those who seek the truth.
    private handleGet(_req: any, res: any): void {
        try {
            const content = fs.readFileSync(this.readmePath, 'utf-8');
            res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
            res.send(content);
        } catch (e) {
            res.status(500).json({ error: 'README.md not found' });
        }
    }
}
