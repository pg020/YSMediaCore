YSMediaCore - After Effects panel
Browse. Preview. Import.

INSTALL
  (To remove: run uninstall-windows.bat or ./uninstall-mac.sh)
  Windows: double-click install-windows.bat
  Mac:     run ./install-mac.sh in Terminal
  Restart After Effects, then Window > Extensions > YSMediaCore

USE
  - Back, Forward and clickable folder path let you return to any folder you were in.
  - Pick a folder once (or use the Desktop/Downloads/... buttons).
  - Move the mouse across a video or audio tile to scrub through it.
  - Click audio = play / pause. Double-click = import into the Project panel.
  - Shift + double-click = import and add to the active comp.

APPEARANCE (new)
  Click "Settings" in the panel header.
  - 7 presets, including "Match After Effects" (follows AE's own brightness setting).
  - Custom accent / background / panel / text colors and corner roundness.
  - Background image, animated GIF or looping video, with dim, blur, fit and position.
  - The top bar is transparent over a background image; "Top bar fill" adds a tint back if you want it.
  - "Drag & resize image..." lets you move the background by dragging, and resize it by pulling a corner or using the mouse wheel. Fill / Center buttons and Esc to finish.
  - "My presets": name the current look (colors, shape, background and its position) and press Save; click it later to apply, or Delete it.
  - Folder animation: tiles slide in from the left, one by one, when you open a folder, and from the right when you go Back / Up. Speed or off in Settings.
  - Particles: a particle overlay that drifts around and backs away from the mouse pointer. Turn it on/off, set its Speed (0-300, 100 = normal) and pick its Color (Reset = follow the theme's accent) in Settings. On Windows it also follows the mouse when it is outside the panel (a small PowerShell helper reports the cursor position; move the mouse over the panel once so it can line up). On Mac it reacts only inside the panel.
  - Hover zoom: the file under the mouse grows and goes back to normal size when the mouse leaves. Turn it off or set the Amount (100-200%, 100 = no zoom) in Settings.
  - Settings are saved automatically. "Reset all" restores the original look.
  - Drag the bar between the controls and the file grid: up makes the whole top section smaller, down makes it bigger. Double-click the bar to reset.

NOTE
  If a video tile shows a camera icon instead of a preview, the panel's built-in
  browser can't decode that codec. The file still imports normally.

SETTINGS
  Your settings are also saved to %APPDATA%\YSMediaCore\settings.json (macOS: ~/Library/Application Support/YSMediaCore), so clearing the CEP cache no longer resets them.
