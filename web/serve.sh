#!/bin/sh
# Serve the presentation locally. ES modules will not load from file://.
PORT="${1:-8848}"
cd "$(dirname "$0")" || exit 1
echo "Dhruva Defence presentation → http://localhost:$PORT"
exec python3 -m http.server "$PORT"
