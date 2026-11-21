$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath "C:\Windows\System32\cmd.exe" -ArgumentList "/c `"C:\Program Files\nodejs\npm.cmd`" run dev" -WorkingDirectory $root -WindowStyle Hidden
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 1
    if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { break }
  }
}
Start-Process -FilePath "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "http://localhost:3000/projects/new"
