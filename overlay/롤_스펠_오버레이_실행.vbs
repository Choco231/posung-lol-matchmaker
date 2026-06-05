Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

base = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = base

cmd = "cmd.exe /c " & Chr(34) & base & "\start-overlay.cmd" & Chr(34)
shell.Run cmd, 0, False
