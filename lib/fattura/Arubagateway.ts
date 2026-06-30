// =============================================================================
//  arubaGateway.ts — Adapter per Aruba (DA COMPLETARE al Passo 4).
//
//  Implementa la stessa interfaccia GatewayFatture del Mock. Quando avrai le
//  credenziali demo, riempiamo i TODO qui sotto e il resto del sistema funziona
//  già senza modifiche.
// =============================================================================
import { GatewayFatture, EsitoInvio } from './gateway';

export interface ConfigAruba {
  baseUrl: string;   // URL ambiente: DEMO prima, PRODUZIONE poi
  username: string;
  password: string;
}

export class ArubaGateway implements GatewayFatture {
  constructor(private cfg: ConfigAruba) {}

  async invia(xml: string, nomeFile: string): Promise<EsitoInvio> {
    // TODO Passo 4:
    //  1) autenticazione su this.cfg.baseUrl -> ottieni access token
    //  2) POST dell'XML (in genere base64) all'endpoint di invio
    //  3) mappa la risposta Aruba -> EsitoInvio { sdiId, stato: 'inviata' }
    throw new Error('ArubaGateway.invia: da implementare al Passo 4 (servono le credenziali demo).');
  }

  async statoCorrente(sdiId: string): Promise<EsitoInvio> {
    // TODO Passo 5:
    //  GET stato/notifiche per sdiId -> mappa in EsitoInvio
    //  (consegnata | scartata | ...). In alternativa si usa il webhook.
    throw new Error('ArubaGateway.statoCorrente: da implementare al Passo 5.');
  }
}
