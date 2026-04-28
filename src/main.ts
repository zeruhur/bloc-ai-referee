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
import { cmdRegistraAccordoPubblico } from './commands/RegistraAccordoPubblico';
import { cmdDichiaraTradimento } from './commands/DichiaraTradimento';
import { cmdSciogliAccordo } from './commands/SciogliAccordo';
import { cmdGeneraLeader } from './commands/GeneraLeader';
import { cmdEliminaFazione, cmdRipristinaFazione } from './commands/EliminaFazione';
import { cmdConvertiAIA, cmdConvertiAUmano } from './commands/ConvertiControlloFazione';

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
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
