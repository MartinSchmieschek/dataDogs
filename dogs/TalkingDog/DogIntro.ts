// DogIntro.ts
export class DogIntro {
  name: string;
  mediaUrl: string;
  ingredients: string[];
  steps: string[];

  constructor(opts: {
    name: string;
    mediaUrl: string;
    ingredients?: string[];
    steps?: string[];
  }) {
    this.name = opts.name;
    this.mediaUrl = opts.mediaUrl;
    this.ingredients = opts.ingredients ?? [];
    this.steps = opts.steps ?? [];
  }

  private escapeHtml(s: string): string {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private renderMedia(): string {
    const url = this.escapeHtml(this.mediaUrl);
    const isVideo = /\.(mp4|webm|ogg)$/i.test(url);

    if (isVideo) {
      return `
        <video class="dog-media" autoplay muted loop playsinline>
          <source src="${url}" type="video/${url.split(".").pop()}">
          Dein Browser unterstützt das Video-Tag nicht.
        </video>
      `;
    } else {
      return `<img class="dog-media" src="${url}" alt="Bild von ${this.escapeHtml(this.name)}" />`;
    }
  }

  render(): string {
    const nameEsc = this.escapeHtml(this.name);

    const ingredientsHtml = this.ingredients.length
      ? `<ul class="dog-list">${this.ingredients.map(i => `<li>${this.escapeHtml(i)}</li>`).join("")}</ul>`
      : `<p class="dog-empty">Keine Zutaten angegeben.</p>`;

    const stepsHtml = this.steps.length
      ? `<ol class="dog-list">${this.steps.map(s => `<li>${this.escapeHtml(s)}</li>`).join("")}</ol>`
      : `<p class="dog-empty">Keine Zubereitungsschritte angegeben.</p>`;

    return `
      <section class="dog-card">
        <style>
          .dog-card {
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial;
            max-width: 600px;
            margin: 2rem auto;
            background: #fff;
            border-radius: 20px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            overflow: hidden;
            border: 1px solid #e0e0e0;
            position: relative;
          }
          .dog-header {
            text-align: center;
            padding: 1rem;
            background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
          }
          .dog-media {
            width: 100%;
            max-height: 400px;
            object-fit: cover;
            display: block;
          }
          .dog-header h2 {
            margin: 1rem 0 0.25rem;
            font-size: 1.8rem;
            color: #333;
          }
          .dog-header p {
            margin: 0;
            color: #555;
            font-size: 1rem;
          }
          .dog-section {
            padding: 1rem 1.5rem;
            border-top: 1px solid #f0f0f0;
          }
          .dog-section h3 {
            margin: 0 0 0.5rem;
            font-size: 1.2rem;
            color: #444;
          }
          .dog-list {
            padding-left: 1.2rem;
            margin: 0;
            color: #333;
          }
          .dog-list li {
            margin: 0.25rem 0;
          }
          .dog-empty {
            color: #999;
            font-style: italic;
          }
          .dog-nav {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            font-size: 2rem;
            background: rgba(0,0,0,0.4);
            color: #fff;
            border: none;
            border-radius: 50%;
            width: 48px;
            height: 48px;
            cursor: pointer;
            line-height: 48px;
            text-align: center;
            transition: background 0.2s;
          }
          .dog-nav:hover {
            background: rgba(0,0,0,0.6);
          }
          .dog-nav.left {
            left: 12px;
          }
          .dog-nav.right {
            right: 12px;
          }
        </style>

        <div class="dog-header">
          ${this.renderMedia()}
          <h2>${nameEsc}</h2>
          <p>Hallo, ich bin ${nameEsc}! 🐾</p>
        </div>

        <div class="dog-section">
          <h3>🍖 Meine Zutaten</h3>
          ${ingredientsHtml}
        </div>

        <div class="dog-section">
          <h3>👨‍🍳 So fütterst du mich</h3>
          ${stepsHtml}
        </div>

        <button class="dog-nav left" onclick="location.reload()">&#8249;</button>
        <button class="dog-nav right" onclick="location.reload()">&#8250;</button>
      </section>
    `;
  }
}
