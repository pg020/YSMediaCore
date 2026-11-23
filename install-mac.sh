#!/bin/bash
# YUESHI MEDIA CORE (YSMediaCore)
EXT="$HOME/Library/Application Support/Adobe/CEP/extensions"
DEST="$EXT/YSMediaCore"
rm -rf "$EXT/MediaScrub"   # earlier "Media Scrub" version
mkdir -p "$DEST" && cp -R "$(dirname "$0")/." "$DEST"
for v in 9 10 11 12; do defaults write com.adobe.CSXS.$v PlayerDebugMode 1; done
echo "Installed to $DEST. Restart After Effects, then Window > Extensions > YSMediaCore"
