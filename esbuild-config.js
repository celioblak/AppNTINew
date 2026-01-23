// Configuração para ESBuild (usado pelo Angular)
module.exports = {
  // Configurações para lidar com módulos problemáticos
  plugins: [{
    name: 'fix-novnc',
    setup(build) {
      build.onLoad({ filter: /@novnc\/novnc\/lib\/util\/browser\.js$/ }, async (args) => {
        let contents = await require('fs').promises.readFile(args.path, 'utf8');

        // Garante que não há top-level await
        if (contents.includes('await _getWebCodecsH264DecodeSupport()')) {
          contents = contents.replace(
            /export\s*{[^}]+}\s*=\s*await\s*_getWebCodecsH264DecodeSupport\(\);/,
            `export const supportsWebCodecsH264Decode = false;
export const supportsWebCodecsH264DecodePromise = Promise.resolve(false);`
          );
        }

        return { contents };
      });
    }
  }]
};
