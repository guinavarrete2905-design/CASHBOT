#!/bin/sh
# Roda testes puros (sem React/Supabase) com o Node, quando não dá para instalar o Vitest.
exec node --experimental-strip-types --no-warnings --import ./scripts/node-test/register.mjs scripts/node-test/run.mjs "$@"
