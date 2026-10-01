// Wrapper para importação segura do noVNC
export class NoVNCWrapper {
  private static rfbModule: any = null;

  static async loadRFB(): Promise<any> {
    if (!this.rfbModule) {
      try {
        // Tenta importar dinamicamente
        this.rfbModule = await import('@novnc/novnc');
      } catch (error) {
        console.error('Erro ao carregar noVNC:', error);
        throw error;
      }
    }
    return this.rfbModule;
  }
}
