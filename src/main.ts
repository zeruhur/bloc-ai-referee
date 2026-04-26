import { Plugin } from 'obsidian';
import type { RollResult } from './types';
import type { BlocPluginSettings } from './types';
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

export default class BlocPlugin extends Plugin {
  settings: BlocPluginSettings = DEFAULT_SETTINGS;
  lastRolls: RollResult[] = [];

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new BlocSettingsTab(this.app, this));

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
      id: 'registra-accordo-privato',
      name: 'BLOC: Registra accordo privato',
      callback: () => cmdRegistraAccordoPrivato(this.app, this),
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
