#!/bin/sh
set -e

# Apply pending database migrations before starting the server.
# Uses the direct (non-pooled) connection if provided.
echo "→ Applying database migrations..."
node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma || {
  echo "✖ Migration failed"; exit 1;
}

echo "→ Starting EMS server..."
exec "$@"
