import { Component, computed, input, output, signal } from '@angular/core';
import { BaseDogInfo, DogInfo, SerializedDogInfo, isBaseDog } from '../../../models/dog.model';

export type PaletteFilter = 'all' | 'base' | 'serialized';

/**
 * Dog palette — replaces the old dog-toolbar.
 * Mobile: bottom-sheet with peek state showing search + filters.
 * Desktop: collapsible side-rail.
 *
 * Interaction:
 *   - tap an item → emits `dogAdded` (primary interaction)
 *   - drag an item → emits the lineageId via dataTransfer (legacy interaction)
 */
@Component({
  selector: 'app-waves-dog-palette',
  standalone: true,
  templateUrl: './waves-dog-palette.component.html',
  styleUrls: ['./waves-dog-palette.component.scss'],
})
export class WavesDogPaletteComponent {
  readonly availableDogs = input<DogInfo[]>([]);
  readonly open = input<boolean>(false);
  /** Render mode: 'overlay' shows as drawer/sheet; 'docked' renders inline. */
  readonly mode = input<'overlay' | 'docked'>('overlay');

  readonly closeRequested = output<void>();
  readonly newDogRequested = output<void>();
  readonly dogAdded = output<string>();  // emits lineageId / base-id

  readonly searchQuery = signal('');
  readonly filter = signal<PaletteFilter>('all');

  readonly filteredDogs = computed<DogInfo[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const f = this.filter();
    let list: DogInfo[] = this.availableDogs();

    if (f === 'base') {
      list = list.filter(isBaseDog);
    } else if (f === 'serialized') {
      list = list.filter((d): d is SerializedDogInfo => !isBaseDog(d));
    }

    if (!q) return list;
    return list.filter((d) => this.matches(d, q));
  });

  readonly counts = computed(() => {
    const dogs = this.availableDogs();
    return {
      all: dogs.length,
      base: dogs.filter(isBaseDog).length,
      serialized: dogs.filter((d) => !isBaseDog(d)).length,
    };
  });

  isBaseDog(dog: DogInfo): dog is BaseDogInfo { return isBaseDog(dog); }

  labelFor(dog: DogInfo): string {
    if (isBaseDog(dog)) return dog.name;
    return (dog as SerializedDogInfo).displayName || (dog as SerializedDogInfo).id;
  }

  descriptionFor(dog: DogInfo): string | null {
    if (isBaseDog(dog)) return dog.description ?? null;
    return null;
  }

  iconFor(dog: DogInfo): string | undefined { return dog.icon; }

  categoryFor(dog: DogInfo): 'Base' | 'Serialized' {
    return isBaseDog(dog) ? 'Base' : 'Serialized';
  }

  setFilter(f: PaletteFilter): void { this.filter.set(f); }

  onAdd(dog: DogInfo): void {
    this.dogAdded.emit(this.refFor(dog));
  }

  onDragStart(event: DragEvent, dog: DogInfo): void {
    const ref = this.refFor(dog);
    event.dataTransfer?.setData('application/dog-id', ref);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  private refFor(dog: DogInfo): string {
    if (!isBaseDog(dog) && (dog as SerializedDogInfo).lineageId) {
      return (dog as SerializedDogInfo).lineageId!;
    }
    return dog.id;
  }

  private matches(dog: DogInfo, q: string): boolean {
    if (isBaseDog(dog)) {
      const hay = [dog.name, dog.id, dog.description].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    }
    const s = dog as SerializedDogInfo;
    const hay = [s.displayName, s.id, s.lineageId, s.parentId ?? undefined, s.theRun]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  }
}
