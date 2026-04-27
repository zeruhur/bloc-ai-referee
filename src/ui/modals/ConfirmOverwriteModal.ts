import { App, Modal } from 'obsidian';

export function confirmOverwrite(app: App, fileName: string): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmOverwriteModal(app, fileName, resolve).open();
  });
}

export function confirmDialog(app: App, title: string, message: string, confirmLabel = 'Conferma'): Promise<boolean> {
  return new Promise((resolve) => {
    new GenericConfirmModal(app, title, message, confirmLabel, resolve).open();
  });
}

class GenericConfirmModal extends Modal {
  constructor(
    app: App,
    private title: string,
    private message: string,
    private confirmLabel: string,
    private resolve: (value: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: this.title });
    contentEl.createEl('p', { text: this.message });

    const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    btnContainer.createEl('button', { text: 'Annulla' }).addEventListener('click', () => {
      this.resolve(false);
      this.close();
    });
    btnContainer.createEl('button', { text: this.confirmLabel, cls: 'mod-cta' }).addEventListener('click', () => {
      this.resolve(true);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class ConfirmOverwriteModal extends Modal {
  constructor(
    app: App,
    private fileName: string,
    private resolve: (value: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: 'File già esistente' });
    contentEl.createEl('p', {
      text: `Il file "${this.fileName}" esiste già. Vuoi sovrascriverlo?`,
    });

    const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });

    btnContainer.createEl('button', { text: 'Annulla' }).addEventListener('click', () => {
      this.resolve(false);
      this.close();
    });

    const confirmBtn = btnContainer.createEl('button', {
      text: 'Sovrascrivi',
      cls: 'mod-warning',
    });
    confirmBtn.addEventListener('click', () => {
      this.resolve(true);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
