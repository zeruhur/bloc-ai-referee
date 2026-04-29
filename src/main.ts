import { Plugin } from 'obsidian';
import type { RollResult } from './types';
import type { BlocPluginSettings } from './types';
import { VIEW_TYPE_REFEREE, RefereeView } from './ui/RefereeView';
import { DEFAULT_SETTINGS } from './constants';
import { BlocSettingsTab } from './ui/SettingsTab';
import { cmdNuovaCampagna } from './commands/NuovaCampagna';
import { cmdDichiaraAzione } from './commands/DichiaraAzione';
import { cmdGeneraMatrice } from './commands/GeneraMatrice';
import { cmdAggiornaSvantaggi } from './commands/AggiornaSvantaggi';
import { cmdValutaAzioni } from './commands/ValutaAzioni';
import { cmdEseguiTiri } from './commands/EseguiTiri';
import { cmdGeneraConseguenze } from './commands/GeneraConseguenze';
import { cmdChiudiTurno } from './commands/ChiudiTurno';
import { cmdStatoCampagna } from './commands/StatoCampagna';
import { cmdAutoControArgomentazione } from './commands/AutoControArgomentazione';
import { cmdAttivaAzioneLatente } from './commands/AttivaAzioneLatente';
import { cmdInterrogaOracolo } from './commands/InterrogaOracolo';
import { cmdVerificaLeader } from './commands/VerificaLeader';
import { cmdEliminaLeader } from './commands/EliminaLeader';
import { cmdRegistraAccordoPrivato } from './commands/RegistraAccordoPrivato';
import { cmdRegistraAccordoPubblico } from './commands/RegistraAccordoPubblico';
import { cmdDichiaraTradimento } from './commands/DichiaraTradimento';
import { cmdSciogliAccordo } from './commands/SciogliAccordo';
import { cmdGeneraLeader } from './commands/GeneraLeader';
import { cmdEliminaFazione, cmdRipristinaFazione } from './commands/EliminaFazione';
import { cmdConvertiAIA, cmdConvertiAUmano } from './commands/ConvertiControlloFazione';
import { cmdModificaFazione } from './commands/ModificaFazione';
import { cmdSospendiFazione, cmdRiattivaSospesa } from './commands/SospendiFazione';
import { cmdModificaVantaggi } from './commands/ModificaVantaggi';
import { cmdFondiFazioni } from './commands/FondiFazioni';
import { cmdAggiungiNuovaFazione } from './commands/AggiungiNuovaFazione';
import { cmdScissioneFazione } from './commands/ScissioneFazione';
import { cmdChiudiCampagna } from './commands/ChiudiCampagna';
import { cmdSimulaTurno } from './commands/SimulaTurno';
import { cmdGeneraFazione } from './commands/GeneraFazione';
import { migrateVaultYaml } from './vault/migrateLegacyYaml';

export default class BlocPlugin extends Plugin {
  settings: BlocPluginSettings = DEFAULT_SETTINGS;
  lastRolls: RollResult[] = [];

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new BlocSettingsTab(this.app, this));

    this.registerView(VIEW_TYPE_REFEREE, leaf => new RefereeView(leaf, this));

    this.addRibbonIcon('shield', 'BLOC Referee', () => {
      void this.activateRefereeView();
    });

    this.app.workspace.onLayoutReady(() => {
      void migrateVaultYaml(this.app).then(() => this.activateRefereeView());
    });

    this.addCommand({
      id: 'nuova-campagna',
      name: 'BLOC: Nuova campagna',
      callback: () => cmdNuovaCampagna(this.app, this),
    });

    this.addCommand({
      id: 'dichiara-azione',
      name: 'BLOC: Dichiara azione',
      callback: () => cmdDichiaraAzione(this.app, this),
    });

    this.addCommand({
      id: 'genera-matrice',
      name: 'BLOC: Genera matrice',
      callback: () => cmdGeneraMatrice(this.app, this),
    });

    this.addCommand({
      id: 'aggiorna-svantaggi',
      name: 'BLOC: Aggiorna svantaggi',
      callback: () => cmdAggiornaSvantaggi(this.app, this),
    });

    this.addCommand({
      id: 'auto-contro-argomentazione',
      name: 'BLOC: Auto contro-argomentazione',
      callback: () => cmdAutoControArgomentazione(this.app, this),
    });

    this.addCommand({
      id: 'valuta-azioni',
      name: 'BLOC: Valuta azioni',
      callback: () => cmdValutaAzioni(this.app, this),
    });

    this.addCommand({
      id: 'esegui-tiri',
      name: 'BLOC: Esegui tiri',
      callback: () => cmdEseguiTiri(this.app, this),
    });

    this.addCommand({
      id: 'genera-conseguenze',
      name: 'BLOC: Genera conseguenze',
      callback: () => cmdGeneraConseguenze(this.app, this),
    });

    this.addCommand({
      id: 'chiudi-turno',
      name: 'BLOC: Chiudi turno',
      callback: () => cmdChiudiTurno(this.app, this),
    });

    this.addCommand({
      id: 'stato-campagna',
      name: 'BLOC: Stato campagna',
      callback: () => cmdStatoCampagna(this.app, this),
    });

    this.addCommand({
      id: 'attiva-azione-latente',
      name: 'BLOC: Attiva azione latente',
      callback: () => cmdAttivaAzioneLatente(this.app, this),
    });

    this.addCommand({
      id: 'interroga-oracolo',
      name: 'BLOC: Interroga oracolo',
      callback: () => cmdInterrogaOracolo(this.app, this),
    });

    this.addCommand({
      id: 'verifica-leader',
      name: 'BLOC: Verifica disponibilità leader',
      callback: () => cmdVerificaLeader(this.app, this),
    });

    this.addCommand({
      id: 'elimina-leader',
      name: 'BLOC: Elimina leader fazione',
      callback: () => cmdEliminaLeader(this.app, this),
    });

    this.addCommand({
      id: 'elimina-fazione',
      name: 'BLOC: Elimina fazione',
      callback: () => cmdEliminaFazione(this.app, this),
    });

    this.addCommand({
      id: 'ripristina-fazione',
      name: 'BLOC: Ripristina fazione',
      callback: () => cmdRipristinaFazione(this.app, this),
    });

    this.addCommand({
      id: 'converti-a-ia',
      name: 'BLOC: Converti fazione a controllo IA',
      callback: () => cmdConvertiAIA(this.app, this),
    });

    this.addCommand({
      id: 'converti-a-umano',
      name: 'BLOC: Converti fazione a controllo umano',
      callback: () => cmdConvertiAUmano(this.app, this),
    });

    this.addCommand({
      id: 'modifica-fazione',
      name: 'BLOC: Modifica profilo fazione',
      callback: () => cmdModificaFazione(this.app, this),
    });

    this.addCommand({
      id: 'sospendi-fazione',
      name: 'BLOC: Sospendi fazione',
      callback: () => cmdSospendiFazione(this.app, this),
    });

    this.addCommand({
      id: 'riattiva-fazione',
      name: 'BLOC: Riattiva fazione sospesa',
      callback: () => cmdRiattivaSospesa(this.app, this),
    });

    this.addCommand({
      id: 'modifica-vantaggi-fazione',
      name: 'BLOC: Modifica vantaggi fazione',
      callback: () => cmdModificaVantaggi(this.app, this),
    });

    this.addCommand({
      id: 'fondi-fazioni',
      name: 'BLOC: Fondi fazioni',
      callback: () => cmdFondiFazioni(this.app, this),
    });

    this.addCommand({
      id: 'aggiungi-nuova-fazione',
      name: 'BLOC: Aggiungi nuova fazione',
      callback: () => cmdAggiungiNuovaFazione(this.app, this),
    });

    this.addCommand({
      id: 'scindi-fazione',
      name: 'BLOC: Scindi fazione',
      callback: () => cmdScissioneFazione(this.app, this),
    });

    this.addCommand({
      id: 'registra-accordo-privato',
      name: 'BLOC: Registra accordo privato',
      callback: () => cmdRegistraAccordoPrivato(this.app, this),
    });

    this.addCommand({
      id: 'registra-accordo-pubblico',
      name: 'BLOC: Registra accordo pubblico',
      callback: () => cmdRegistraAccordoPubblico(this.app, this),
    });

    this.addCommand({
      id: 'dichiara-tradimento',
      name: 'BLOC: Dichiara tradimento',
      callback: () => cmdDichiaraTradimento(this.app, this),
    });

    this.addCommand({
      id: 'sciogli-accordo',
      name: 'BLOC: Sciogli accordo',
      callback: () => cmdSciogliAccordo(this.app, this),
    });

    this.addCommand({
      id: 'genera-leader',
      name: 'BLOC: Genera leader fazione',
      callback: () => cmdGeneraLeader(this.app, this),
    });

    this.addCommand({
      id: 'chiudi-campagna',
      name: 'BLOC: Chiudi campagna',
      callback: () => cmdChiudiCampagna(this.app, this),
    });

    this.addCommand({
      id: 'simula-turno',
      name: 'BLOC: Simula turno (IA)',
      callback: () => cmdSimulaTurno(this.app, this),
    });

    this.addCommand({
      id: 'genera-fazione',
      name: 'BLOC: Genera fazione (IA)',
      callback: () => cmdGeneraFazione(this.app, this),
    });
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_REFEREE);
  }

  async activateRefereeView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_REFEREE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_REFEREE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
