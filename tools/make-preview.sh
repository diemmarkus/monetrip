#!/bin/sh
# Copy a branch into preview/ so it can be tried at https://diemmarkus.github.io/monetrip/preview/
# before it goes live. Same sign-in and same Firestore data as the live app (it IS the live data).
#   tools/make-preview.sh sentence-form      # then commit preview/ on main and push
#   tools/make-preview.sh --remove           # take the preview down
# The copy registers no service worker and is marked noindex; the live service worker ignores it.
set -e
cd "$(dirname "$0")/.."
rm -rf preview
[ "$1" = "--remove" ] && { echo "preview/ removed"; exit 0; }
BR="${1:?branch name}"
git fetch -q origin "$BR"
mkdir preview
git archive "origin/$BR" -- . ':(exclude)tools' ':(exclude).claude' ':(exclude)preview' ':(exclude)firestore.rules' ':(exclude)LICENSE' ':(exclude)README.md' | tar -x -C preview
# no service worker for the copy: always load fresh from the network
sed -i 's/navigator\.serviceWorker\.register("sw\.js")/Promise.reject()/' preview/app.js
rm -f preview/sw.js
sed -i 's#<head>#<head>\n<meta name="robots" content="noindex">#' preview/index.html
echo "$BR @ $(git rev-parse --short "origin/$BR")" > preview/BRANCH.txt
echo "preview/ now holds $(cat preview/BRANCH.txt)"
