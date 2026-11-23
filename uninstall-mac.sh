#!/bin/bash
# Removes YSMediaCore from After Effects.
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/YSMediaCore"
if [ -d "$DEST" ]; then rm -rf "$DEST"; echo "YSMediaCore was removed from $DEST"; else echo "YSMediaCore is not installed."; fi
read -p 'Also turn off "allow unsigned panels" (PlayerDebugMode)? Other panels may need it. [y/N]: ' a
if [[ "$a" == [yY] ]]; then for v in 9 10 11 12; do defaults delete com.adobe.CSXS.$v PlayerDebugMode 2>/dev/null; done; echo "PlayerDebugMode removed."; fi
read -p "Also delete your saved settings? [y/N]: " c
if [[ "$c" == [yY] ]]; then rm -rf "$HOME/Library/Application Support/YSMediaCore"; fi
echo "Restart After Effects to finish."
