---
title: Advanced waiting for processes on Windows for showing off on Steam
tags: 灵车
---

It's well known that you can add external programs on Steam to friendly remind your friends that you are doing hard work™ and maybe they should too.

<figure>
  <img src="https://layered-assets.thu.fail/2025-10-13-steam-vscode.png">
  <figcaption>There would be a very noisy popup on your friend's screen</figcaption>
</figure>

But most windows programs have quirks that makes this method of showing off not exactly reliable:
1. Programs often auto-updates by calling an updater, exits, and waits for the updater to re-execute itself.
2. Sometimes processes want to be singleton so they try to find existing running instance and exits immediately upon seeing one.
3. Some games uses launchers, and Steam lose track of the process once the launcher exits.

VSCode does 1 & 2, and most Galgames would require some form of 3 (and also 2).

To reliably impress our friends on Steam, we may need some tech.

```bat
REM run.bat
C:\Run\Your\Launcher.exe

sleep 5
powershell -command "Get-Process 'ProcName' | ForEach-Object {$_.WaitForExit()}"
```

This script waits for five seconds, and waits for all processes with `ProcName` to exit. This is already sufficient for case 2 & 3, but may suffer from process name collision. To mitigate that and also solve case 1, we need a loop.

```bat
REM run.bat
C:\Run\Your\Launcher.exe
powershell -Command "while ($true) { Start-Sleep -Seconds 5; $procs = Get-Process | Where-Object { $_.Path -eq 'C:\Your\Program.exe' }; if ($procs.Count -eq 0) { break }; $procs[0].WaitForExit() }"
```

Unfortunately I did not figure out how to do multi-line literal in argument place with batch scripts, so this abomination will have to do.

Finally, don't forget to set the library page name and background.

<figure>
  <img src="https://layered-assets.thu.fail/2025-10-13-steam-sakura.png" class="preview">
  <figcaption><a href="https://bgm.tv/subject/233030">https://bgm.tv/subject/233030</a></figcaption>
</figure>