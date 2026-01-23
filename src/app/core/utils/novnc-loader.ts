let RFB: any = null;

export async function loadNoVNC(): Promise<any> {
  if (RFB) return RFB;

  // Tenta diferentes métodos de carregamento
  try {
    // Método 1: Importação direta
    const module = await import(
      /* webpackChunkName: "novnc" */
      '@novnc/novnc/lib/rfb'
    );
    RFB = module.default || module;
    return RFB;
  } catch (error1) {
    console.warn('Método 1 falhou:', error1);

    try {
      // Método 2: Usar eval para carregar
      const novncPath = require.resolve('@novnc/novnc/lib/rfb');
      const fs = await import('fs');
      const code = fs.readFileSync(novncPath, 'utf8');
      // Cria um módulo temporário
      const module = { exports: {} };
      eval(code);
      RFB = module.exports;
      return RFB;
    } catch (error2) {
      console.error('Todos os métodos falharam:', error2);
      throw new Error('Não foi possível carregar o noVNC');
    }
  }
}
