export abstract class FragmentRenderer<T> {
    abstract render(data: T): string;
  }
  