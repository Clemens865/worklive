#!/bin/zsh
cd "$(dirname "$0")"
python3 -m http.server 8776 --bind 127.0.0.1
