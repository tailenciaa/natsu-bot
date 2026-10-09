# Kazuki bot - otomatik GitHub yedekleme
# Değişiklikleri 60 saniyede bir toplu olarak GitHub'a gönderir; Railway oradan alır.
# Durdurmak için bu pencereyi kapat (gizli çalışıyorsa Görev Yöneticisi'nden ilgili
# powershell işlemini sonlandır). Olaylar yedek.log dosyasına yazılır.

Set-Location -Path $PSScriptRoot

$logFile  = Join-Path $PSScriptRoot 'yedek.log'
$interval = 60

function Log-Yedek([string]$message) {
    $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
    try {
        [System.IO.File]::AppendAllText($logFile, $line + "`r`n", (New-Object System.Text.UTF8Encoding($false)))
    } catch { }
}

# Tek örnek koruması: arka planda zaten çalışan bir örnek varsa bu örneği kapatır.
# Böylece yanlışlıkla iki kez başlatılınca push'lar birbirine karışmaz.
$running = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like '*-File*' -and $_.CommandLine -like '*auto-push.ps1*' }
if ($running) {
    $pids = ($running | ForEach-Object { $_.ProcessId }) -join ', '
    Write-Host "Zaten calisan bir ornek var (PID $pids), bu pencere kapaniyor." -ForegroundColor Yellow
    Log-Yedek "Zaten calisan bir ornek oldugu icin yeni ornek kapatildi (PID $pids)."
    exit 0
}

Write-Host "Otomatik GitHub yedekleme baslatildi. Her $interval saniyede bir kontrol ediliyor." -ForegroundColor Green
Log-Yedek 'Yedekleme baslatildi.'

while ($true) {
    $changes = git status --porcelain
    if ($changes) {
        $time = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        git add -A
        git commit -m "otomatik yedek: $time" | Out-Null
        $pushOut = git push 2>&1 | Out-String
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[$time] Degisiklikler GitHub'a gonderildi." -ForegroundColor Cyan
            Log-Yedek 'OK - Degisiklikler GitHuba gonderildi.'
        } else {
            Write-Host "[$time] Push basarisiz! Detay: $logFile" -ForegroundColor Yellow
            Log-Yedek "HATA - Push basarisiz, cikti:`r`n$pushOut"
        }
    }
    Start-Sleep -Seconds $interval
}
