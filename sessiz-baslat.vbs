' Kazuki - sessiz otomatik yedekleme başlatıcı
' Bu dosya Windows açılışında arka planda (pencere göstermeden) auto-push.ps1'i çalıştırır.
Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & scriptDir & "\auto-push.ps1""", 0, False
