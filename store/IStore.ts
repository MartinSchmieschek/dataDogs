export interface IStore {
  save(d: any): Promise<void>;
  load(id: string): Promise<any>;
  findByType(type: string): Promise<Array<{ id: string; serilizedDogConfig: string }>>;
}
