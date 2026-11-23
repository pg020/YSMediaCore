// Runs inside After Effects (ExtendScript)
function importMedia(filePath, addToComp) {
    try {
        var f = new File(filePath);
        if (!f.exists) return "error: file not found";
        app.beginUndoGroup("YSMediaCore import");
        var io = new ImportOptions(f);
        var item = app.project.importFile(io);
        if (addToComp) {
            var comp = app.project.activeItem;
            if (comp && comp instanceof CompItem) {
                comp.layers.add(item);
            } else {
                app.endUndoGroup();
                return "imported (no active comp to add to)";
            }
        }
        app.endUndoGroup();
        return addToComp ? "imported + added to comp" : "imported";
    } catch (e) {
        try { app.endUndoGroup(); } catch (x) {}
        return "error: " + e.toString();
    }
}

// Native Windows/macOS dialogs (same look as After Effects' own "Output Movie To" dialog).
// Return the chosen path, "" if cancelled.
function pickBackground(startDir) {
    try {
        try { if (startDir) { var s = new Folder(startDir); if (s.exists) Folder.current = s; } } catch (x) {}
        var filter = ($.os.indexOf("Windows") > -1)
            ? "Images, GIF and video:*.png;*.jpg;*.jpeg;*.gif;*.webp;*.bmp;*.svg;*.mp4;*.webm;*.m4v;*.mov,All files:*.*"
            : function (f) { return (f instanceof Folder) || /\.(png|jpe?g|gif|webp|bmp|svg|mp4|webm|m4v|mov)$/i.test(f.name); };
        var f = File.openDialog("Choose a background image, GIF or video", filter, false);
        return f ? f.fsName : "";
    } catch (e) { return "error: " + e.toString(); }
}
function pickFolder(startDir) {
    try {
        var s = startDir ? new Folder(startDir) : null;
        var f = (s && s.exists) ? s.selectDlg("Choose your media folder") : Folder.selectDialog("Choose your media folder");
        return f ? f.fsName : "";
    } catch (e) { return "error: " + e.toString(); }
}
