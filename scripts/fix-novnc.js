const fs = require('fs');
const path = require('path');

console.log('=== Aplicando patch SIMPLES para @novnc/novnc ===');

const browserPath = path.join(__dirname, '../node_modules/@novnc/novnc/lib/util/browser.js');

if (!fs.existsSync(browserPath)) {
  console.error('Arquivo browser.js não encontrado!');
  process.exit(1);
}

let content = fs.readFileSync(browserPath, 'utf8');

// Verifica se já foi modificado
if (content.includes('_supportsWebCodecsH264Decode = false')) {
  console.log('✓ Arquivo já está patchado');
  process.exit(0);
}

// SOLUÇÃO MAIS SIMPLES: Remover completamente a exportação problemática
// e substituir por valores fixos (para maioria dos casos funciona)

const newContent = content.replace(
  /export\s*{\s*supportsWebCodecsH264Decode,\s*supportsWebCodecsH264DecodePromise\s*}\s*=\s*await\s*_getWebCodecsH264DecodeSupport\(\);/,
  `// PATCH: Removido top-level await para compatibilidade com Angular
// Valores padrão - WebCodecs não suportado por padrão
export const supportsWebCodecsH264Decode = false;
export const supportsWebCodecsH264DecodePromise = Promise.resolve(false);

// Inicialização em background (não bloqueante)
(async () => {
  try {
    const result = await _getWebCodecsH264DecodeSupport();
    // Os valores exportados são constantes, então não podemos atualizá-los
    // Mas para maioria dos casos, false é aceitável
    console.debug('WebCodecs support check completed:', result);
  } catch (error) {
    console.debug('WebCodecs check failed:', error);
  }
})();`
);

if (newContent !== content) {
  fs.writeFileSync(browserPath, newContent);
  console.log('✓ Patch aplicado com sucesso!');

  // Também verifica outros arquivos que podem importar isso
  console.log('✓ Verificando arquivos relacionados...');

  const filesToCheck = [
    'lib/rfb.js',
    'lib/input/keyboard.js',
    'lib/input/util.js',
    'lib/util/cursor.js'
  ];

  filesToCheck.forEach(file => {
    const filePath = path.join(__dirname, '../node_modules/@novnc/novnc', file);
    if (fs.existsSync(filePath)) {
      console.log(`  ✓ ${file} encontrado`);
    }
  });
} else {
  console.log('✗ Não foi possível aplicar o patch. Tentando método alternativo...');

  // Método alternativo: encontrar por linha
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('await _getWebCodecsH264DecodeSupport()')) {
      console.log(`Encontrado na linha ${i + 1}`);

      // Reescrever arquivo completamente se necessário
      const fixedContent = `// @novnc/novnc browser.js - Patched for Angular compatibility
// Original code modified to remove top-level await

// ... (restante do código original mantido até a linha problemática) ...

// PATCH APPLIED: Replaced top-level await with safe initialization
export const supportsWebCodecsH264Decode = false;
export const supportsWebCodecsH264DecodePromise = Promise.resolve(false);

// Background initialization
let _webCodecsInitialized = false;
async function initializeWebCodecs() {
  if (!_webCodecsInitialized) {
    try {
      const support = await _getWebCodecsH264DecodeSupport();
      _webCodecsInitialized = true;
      // Log para debugging
      console.debug('WebCodecs initialized:', support);
    } catch (error) {
      console.debug('WebCodecs initialization failed:', error);
    }
  }
}

// Start initialization
initializeWebCodecs().catch(() => {});`;

      // Se necessário, podemos pegar tudo antes da linha problemática
      const linesBefore = lines.slice(0, i - 5); // 5 linhas antes para pegar o contexto
      const finalContent = linesBefore.join('\n') + '\n\n' + fixedContent;

      fs.writeFileSync(browserPath, finalContent);
      console.log('✓ Arquivo completamente reescrito');
      break;
    }
  }
}

console.log('=== Patch finalizado ===');
