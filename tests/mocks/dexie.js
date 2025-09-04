export default class Dexie {
  constructor() {
    this.tables = [];
    this.items = {
      where: () => ({
        equals: () => ({ toArray: async () => [], first: async () => null })
      }),
      add: async () => {},
      bulkAdd: async () => {},
      update: async () => {}
    };
    this.excedentes = {
      toArray: async () => []
    };
    this.meta = {
      put: async () => {},
      get: async () => undefined
    };
    this.settings = this.meta;
    this.lots = {
      add: async () => 1,
      orderBy: () => ({ reverse: () => ({ toArray: async () => [] }) })
    };
  }
  version() { return { stores: () => {} }; }
  delete() { return Promise.resolve(); }
  open() { return Promise.resolve(); }
}
