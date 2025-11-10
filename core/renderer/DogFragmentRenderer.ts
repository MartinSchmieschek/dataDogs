import { FragmentRenderer } from "./FragmentRenderer";

export interface DogData {
  name: string;
  imageUrl: string;
  description?: string;
}

export class DogFragmentRenderer extends FragmentRenderer<DogData> {
  render(data: DogData): string {
    return `
      <div class="dog-fragment">
        <img src="${data.imageUrl}" alt="${data.name}" class="dog-image" />
        <h2>${data.name}</h2>
        <p>${data.description ?? "Ich bin bereit für ein leckeres Menü!"}</p>
      </div>
    `;
  }
}
