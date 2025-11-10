export class DogIntro {
  name: string;
  mediaUrl: string;
  ingredients: string[];
  steps: string[];
  youtubeItem?: {
    id: { videoId: string };
    snippet: { title: string; description: string; thumbnails: { medium: { url: string } } };
  };

  constructor(opts: {
    name: string;
    mediaUrl: string;
    ingredients?: string[];
    steps?: string[];
    youtubeItem?: {
      id: { videoId: string };
      snippet: { title: string; description: string; thumbnails: { medium: { url: string } } };
    };
  }) {
    this.name = opts.name;
    this.mediaUrl = opts.mediaUrl;
    this.ingredients = opts.ingredients ?? [];
    this.steps = opts.steps ?? [];
    this.youtubeItem = opts.youtubeItem;
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

  private renderYoutube(): string {
    if (!this.youtubeItem) return "";
    const videoId = this.escapeHtml(this.youtubeItem.id.videoId);
    const title = this.escapeHtml(this.youtubeItem.snippet.title);

    return `
      <div class="dog-youtube">
        <h4>🎥 Kochanleitung: ${title}</h4>
        <iframe
          src="https://www.youtube.com/embed/${videoId}"
          title="${title}"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
    `;
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
            max-width: 620px;
            margin: 2rem auto;
            background: #fff;
            border-radius: 20px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            overflow: hidden;
            border: 1px solid #e0e0e0;
            position: relative;
            animation: fadeIn 0.5s ease;
          }
          @keyframes fadeIn {
            from {opacity: 0; transform: scale(0.95);}
            to {opacity: 1; transform: scale(1);}
          }
          .dog-header {
            text-align: center;
            padding: 1rem;
            background: linear-gradient(135deg, #fff6e7 0%, #ffd7b5 100%);
          }
          .dog-media {
            width: 100%;
            max-height: 300px;
            object-fit: cover;
            display: block;
            border-radius: 16px;
          }
          .dog-header h2 {
            margin: 1rem 0 0.25rem;
            font-size: 2rem;
            color: #333;
          }
          .dog-header p {
            margin: 0;
            color: #555;
            font-size: 1.1rem;
          }
          .dog-section {
            padding: 1rem 1.5rem;
            border-top: 1px solid #f0f0f0;
          }
          .dog-section h3 {
            margin: 0 0 0.5rem;
            font-size: 1.3rem;
            color: #444;
          }
          .dog-list {
            padding-left: 1.2rem;
            margin: 0;
            color: #333;
          }
          .dog-empty {
            color: #999;
            font-style: italic;
          }
          .dog-youtube {
            margin: 1rem auto;
            padding: 0 1.5rem 1rem;
            border-top: 1px solid #f0f0f0;
          }
          .dog-youtube h4 {
            margin-bottom: 0.5rem;
            font-size: 1.1rem;
            color: #d14c2f;
            text-align: center;
          }
          .dog-youtube iframe {
            width: 100%;
            aspect-ratio: 16/9;
            border-radius: 12px;
            border: none;
            display: block;
            margin: 0 auto;
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
            width: 52px;
            height: 52px;
            cursor: pointer;
            line-height: 52px;
            text-align: center;
            transition: background 0.2s, transform 0.1s;
          }
          .dog-nav:hover {
            background: rgba(0,0,0,0.6);
            transform: scale(1.05);
          }
          .dog-nav.left { left: 14px; }
          .dog-nav.right { right: 14px; }
        </style>

        <div class="dog-header">
          ${this.renderMedia()}
          <h2>${nameEsc}</h2>
          <p>🐾 Ich habe ein Rezept für dich! Schau dir an, wie du es kochst:</p>
        </div>

        <div class="dog-section">
          <h3>🍖 Zutaten</h3>
          ${ingredientsHtml}
        </div>

        <div class="dog-section">
          <h3>👨‍🍳 So kochst du es</h3>
          ${stepsHtml}
        </div>

        ${this.renderYoutube()}

        <button class="dog-nav left" onclick="location.reload()">❌</button>
        <button class="dog-nav right" onclick="location.reload()">❤️</button>
      </section>
    `;
  }
}
