import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Tiny pill that visualizes a kennel/node's visibility. */
@Component({
    selector: 'app-visibility-badge',
    standalone: true,
    imports: [CommonModule],
    template: `
        <span class="badge" [class.public]="isPublic()" [class.private]="!isPublic()" [title]="title()">
            <span class="dot" aria-hidden="true">{{ isPublic() ? '🌐' : '🔒' }}</span>
            <span class="label">{{ isPublic() ? 'Public' : 'Private' }}</span>
        </span>
    `,
    styles: [`
        :host { display: inline-block; }
        .badge {
            display: inline-flex; align-items: center; gap: 4px;
            padding: 2px 8px; border-radius: 999px;
            font-size: 11px; font-weight: 500;
            line-height: 1.4;
        }
        .dot { font-size: 10px; }
        .public {
            background: rgba(80, 200, 120, 0.16);
            color: #9ee99e;
            border: 1px solid rgba(80, 200, 120, 0.3);
        }
        .private {
            background: rgba(220, 180, 80, 0.14);
            color: #ffd07a;
            border: 1px solid rgba(220, 180, 80, 0.3);
        }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisibilityBadgeComponent {
    readonly visibility = input<'public' | 'private' | null | undefined>('public');

    readonly isPublic = computed(() => this.visibility() !== 'private');
    readonly title = computed(() =>
        this.isPublic()
            ? 'Public — anyone can read and run'
            : 'Private — only owner, editors and viewers can read',
    );
}
