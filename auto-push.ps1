# Kazuki bot - otomatik GitHub yedekleme
# Her 60 saniyede bir degisiklik var mi bakar, varsa GitHub'a gonderir.
# Durdurmak icin bu pencereyi kapat.

Set-Location -Path $PSScriptRoot
Write-Host "Otomatik GitHub yedekleme basladi. (Durdurmak icin pencereyi kapat)" -ForegroundColor Green

while ($true) {
    $changes = git status --porcelain
    if ($changes) {
        $time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        git add -A
        git commit -m "otomatik yedek: $time" | Out-Null
        git push 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[$time] Degisiklikler GitHub'a gonderildi." -ForegroundColor Cyan
        } else {
            Write-Host "[$time] Push basarisiz, bir sonraki turda tekrar denenecek." -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 60
}
