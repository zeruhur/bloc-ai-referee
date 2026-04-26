// Minimal Obsidian mock for unit tests
export class Plugin {}
export class Modal {
  app: unknown;
  contentEl = {
    empty: () => {},
    createEl: () => ({ addEventListener: () => {}, createEl: () => ({}) }),
    createDiv: () => ({ createEl: () => ({}), querySelector: () => null }),
  };
  constructor(app: unknown) { this.app = app; }
  open() {}
  close() {}
}
export class SuggestModal extends Modal {
  getSuggestions(_query: string): unknown[] { return []; }
  renderSuggestion(_item: unknown, _el: unknown) {}
  onChooseSuggestion(_item: unknown) {}
}
export class PluginSettingTab {
  containerEl = { empty: () => {}, createEl: () => ({}) };
  constructor(_app: unknown, _plugin: unknown) {}
  display() {}
}
export class Setting {
  constructor(_container: unknown) {}
  setName(_name: string) { return this; }
  setDesc(_desc: string) { return this; }
  addText(_cb: (t: unknown) => void) { _cb({ setValue: () => this, onChange: () => this, setPlaceholder: () => this }); return this; }
  addTextArea(_cb: (t: unknown) => void) { _cb({ setValue: () => this, onChange: () => this }); return this; }
  addDropdown(_cb: (d: unknown) => void) { _cb({ addOption: () => ({ addOption: () => ({}) }), setValue: () => ({}), onChange: () => ({}) }); return this; }
}
export class Notice {
  constructor(_msg: string, _timeout?: number) {}
  hide() {}
  setMessage(_msg: string) {}
}
