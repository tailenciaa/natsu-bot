@echo off
title Kazuki - Otomatik GitHub Yedek
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0auto-push.ps1"
pause
