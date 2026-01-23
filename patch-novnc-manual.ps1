Write-Host "Aplicando patch MANUAL no @novnc/novnc..." -ForegroundColor Cyan

# Caminho do arquivo problemático
$browserFile = "node_modules\@novnc\novnc\lib\util\browser.js"

if (-not (Test-Path $browserFile)) {
    Write-Host "❌ Arquivo não encontrado: $browserFile" -ForegroundColor Red
    Write-Host "Verifique se @novnc/novnc está instalado" -ForegroundColor Yellow
    exit 1
}

Write-Host "Lendo arquivo: $browserFile" -ForegroundColor Yellow
$content = Get-Content $browserFile -Raw

Write-Host "Procurando top-level await na linha 540..." -ForegroundColor Yellow

# Verifica o conteúdo específico
if ($content -match "supportsWebCodecsH264Decode = await _checkWebCodecsH264DecodeSupport") {
    Write-Host "✅ Encontrado o problema!" -ForegroundColor Green

    # Corrige o top-level await
    $content = $content -replace "let supportsWebCodecsH264Decode = await _checkWebCodecsH264DecodeSupport\(\);", "let supportsWebCodecsH264Decode = false; // Patched: removed top-level await"

    # Salva o arquivo
    $content | Out-File -FilePath $browserFile -Encoding UTF8
    Write-Host "✅ Patch aplicado com sucesso!" -ForegroundColor Green

    # Mostra a linha corrigida
    Write-Host "`nLinha 540 após correção:" -ForegroundColor Cyan
    $lines = $content -split "`n"
    if ($lines.Count -ge 540) {
        Write-Host "Linha 540: $($lines[539])" -ForegroundColor White
    }
} else {
    Write-Host "⚠️  Não encontrou o padrão esperado" -ForegroundColor Yellow
    Write-Host "Procurando por outros top-level awaits..." -ForegroundColor Yellow

    # Procura por qualquer top-level await
    if ($content -match "^\s*(let|const|var)\s+\w+\s*=\s*await") {
        Write-Host "Encontrado top-level await genérico" -ForegroundColor Yellow
        $content = $content -replace "^\s*(let|const|var)\s+(\w+)\s*=\s*await\s+(\w+\(\))", "// Patched: $1 $2 = false; // removed: await $3"
        $content | Out-File -FilePath $browserFile -Encoding UTF8
        Write-Host "✅ Patch aplicado!" -ForegroundColor Green
    }
}

# Também vamos corrigir outros arquivos que referenciam browser.js
Write-Host "`nCorrigindo outros arquivos que importam browser.js..." -ForegroundColor Yellow

$filesToCheck = @(
    "node_modules\@novnc\novnc\lib\input\keyboard.js",
    "node_modules\@novnc\novnc\lib\input\util.js",
    "node_modules\@novnc\novnc\lib\rfb.js",
    "node_modules\@novnc\novnc\lib\util\cursor.js"
)

foreach ($file in $filesToCheck) {
    if (Test-Path $file) {
        Write-Host "  Verificando: $file" -ForegroundColor Gray
        $fileContent = Get-Content $file -Raw

        # Verifica se o arquivo importa browser.js
        if ($fileContent -match "require.*browser\.js") {
            Write-Host "  ✅ Contém require de browser.js" -ForegroundColor Green
        }
    }
}

Write-Host "`n✅ Patch manual aplicado!" -ForegroundColor Green
Write-Host "Execute: npm run build" -ForegroundColor Cyan
