// restore-packages.js
const fs = require('fs');
const { execSync } = require('child_process');

// Versões que você tinha antes (baseado no seu package.json inicial)
const originalVersions = {
  "@acrodata/code-editor": "^0.5.1",
  "@angular-devkit/build-angular": "^19.2.4",
  "@angular/animations": "^19.2.10",
  "@angular/cdk": "^19.2.6",
  "@angular/cli": "^19.2.4",
  "@angular/common": "^19.2.3",
  "@angular/compiler": "^19.2.3",
  "@angular/compiler-cli": "^19.2.3",
  "@angular/core": "^19.2.3",
  "@angular/forms": "^19.2.3",
  "@angular/material": "^19.2.6",
  "@angular/material-date-fns-adapter": "^19.2.6",
  "@angular/platform-browser": "^19.2.10",
  "@angular/platform-browser-dynamic": "^19.2.3",
  "@angular/router": "^19.2.3",
  "@commitlint/cli": "^19.8.0",
  "@commitlint/config-conventional": "^19.8.0",
  "@ng-matero/extensions": "^19.4.1",
  "@ng-matero/extensions-date-fns-adapter": "^19.1.0",
  "@ngx-formly/core": "^6.3.10",
  "@ngx-formly/material": "^6.3.10",
  "@ngx-translate/core": "^16.0.0",
  "@ngx-translate/http-loader": "^16.0.0",
  "@primeng/themes": "^19.1.2",
  "@stomp/stompjs": "^7.1.1",
  "@types/dragula": "^2.1.39",
  "@types/jasmine": "~5.1.0",
  "@types/lodash": "^4.17.14",
  "@types/node": "^22.13.0",
  "angular-cli-ghpages": "^2.0.0",
  "angular-eslint": "^19.3.0",
  "angular-in-memory-web-api": "~0.19.0",
  "apexcharts": "^4.5.0",
  "codemirror": "^6.0.1",
  "eslint": "^9.23.0",
  "gulp": "^5.0.0",
  "husky": "^9.1.6",
  "jasmine-core": "~5.1.0",
  "jspdf": "^3.0.3",
  "karma": "~6.4.0",
  "karma-coverage": "~2.2.0",
  "lint-staged": "^15.5.0",
  "moment": "^2.30.0",
  "ng2-dragula": "^2.1.1",
  "ngx-toastr": "^19.0.0",
  "parse5": "^7.2.0",
  "photoviewer": "^3.10.3",
  "prettier": "^3.5.0",
  "primeng": "^19.1.2",
  "rimraf": "^5.0.0",
  "rxjs": "~7.8.0",
  "stylelint": "^16.16.0",
  "stylelint-config-recess-order": "^6.0.0",
  "stylelint-config-recommended-scss": "^14.1.0",
  "stylelint-config-standard": "^37.0.0",
  "tslib": "^2.8.0",
  "typescript": "~5.7.2",
  "typescript-eslint": "^8.27.0",
  "webpack-bundle-analyzer": "^4.10.0",
  "zone.js": "~0.15.0"
};

console.log('🚀 Restaurando versões originais dos pacotes...\n');

// Salva o package.json atual como backup
const currentPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
fs.writeFileSync('package.json.backup', JSON.stringify(currentPackage, null, 2));
console.log('✅ Backup do package.json atual criado como package.json.backup\n');

// Atualiza as versões no package.json
const newPackage = {
  ...currentPackage,
  dependencies: {
    ...currentPackage.dependencies,
    ...originalVersions
  },
  devDependencies: {
    ...currentPackage.devDependencies,
    // Mantém outras devDependencies que não foram listadas
  }
};

// Aplica as versões específicas
Object.keys(originalVersions).forEach(pkg => {
  if (newPackage.dependencies[pkg]) {
    newPackage.dependencies[pkg] = originalVersions[pkg];
  }
  if (newPackage.devDependencies[pkg]) {
    newPackage.devDependencies[pkg] = originalVersions[pkg];
  }
});

// Escreve o novo package.json
fs.writeFileSync('package.json', JSON.stringify(newPackage, null, 2));
console.log('✅ package.json atualizado com versões originais\n');

console.log('🔄 Removendo node_modules e package-lock.json...\n');
try {
  // Remove node_modules e package-lock.json
  if (fs.existsSync('node_modules')) {
    execSync('rm -rf node_modules', { stdio: 'inherit' });
  }
  if (fs.existsSync('package-lock.json')) {
    fs.unlinkSync('package-lock.json');
  }
  console.log('✅ node_modules e package-lock.json removidos\n');
} catch (error) {
  console.error('❌ Erro ao remover arquivos:', error.message);
}

console.log('📦 Instalando dependências...\n');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependências instaladas com sucesso!\n');
} catch (error) {
  console.error('❌ Erro durante npm install:', error.message);
}

console.log('🎉 Restauração completa!');
console.log('Você pode precisar executar:');
console.log('1. npm run build (para verificar se tudo está correto)');
console.log('2. Se houver erros, tente: npm ci');
