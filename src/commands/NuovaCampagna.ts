import type { App } from 'obsidian';
import { NuovaCampagnaModal } from '../ui/modals/NuovaCampagnaModal';
import type BlocPlugin from '../main';

export async function cmdNuovaCampagna(app: App, plugin: BlocPlugin): Promise<void> {
  new NuovaCampagnaModal(app, () => {
    // refresh default slug if empty
  }).open();
}
