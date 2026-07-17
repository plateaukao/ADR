2026-07-18

# EinkBro iOS: input dialogs dismissed themselves on focus

Committed as `d83fa31`.

Report: any dialog with a text field (papago image-key, translated-languages,
ValueSettingItem editors) dismissed the moment the field was tapped.

Root cause: a regression from the same-day no-dim dialog work. CMP's m2
AlertDialog on iOS is popup-based and can't clear its scrim, so those dialogs
were swapped to a Dialog-based wrapper — but compose Dialog's
outside-click detection misfires when the software-keyboard inset shifts the
dialog: the tap that focuses the field is judged "outside" and dismisses.

Fix: `NoDimAlertDialog` disables `dismissOnClickOutside`. Alert-style dialogs
always carry explicit Cancel/OK buttons, so nothing is lost; plain
`NoDimDialog` consumers (menus etc., no text fields) keep tap-outside
dismissal. Simulator-verified: focus, type, dialog stays.
