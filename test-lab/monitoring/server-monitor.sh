#!/usr/bin/env bash
# Per-second server monitor. Run this ON THE SERVER during a test. It appends one
# CSV row per second correlating system + PM2 + Postgres + Redis + BullMQ so the
# analyzer can point at the real bottleneck. Everything is best-effort: a missing
# tool (psql/redis-cli/pm2) leaves its columns blank instead of failing.
#
# Usage:  bash monitoring/server-monitor.sh <out.csv> [seconds]
#   seconds omitted → runs until it receives SIGINT/SIGTERM (the runner stops it).
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set +a

OUT="${1:?usage: server-monitor.sh <out.csv> [seconds]}"
MAX_SECONDS="${2:-0}"   # 0 = until signalled

PGHOST="${PGHOST:-127.0.0.1}"; PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-}"; PGDATABASE="${PGDATABASE:-mica}"
REDIS_HOST="${REDIS_HOST:-127.0.0.1}"; REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
BULLMQ_QUEUES="${BULLMQ_QUEUES:-email webhook-delivery}"
PM2_PROCS="${PM2_PROCS:-mica-api}"

have() { command -v "$1" >/dev/null 2>&1; }

RUN=1
trap 'RUN=0' INT TERM

psql_q() { # <sql> → single scalar, blank on any failure
  [ -z "$PGUSER" ] && { echo ""; return; }
  PGPASSWORD="${PGPASSWORD:-}" psql -tAX -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
    -c "$1" 2>/dev/null | tr -d '[:space:]'
}
redis_cmd() {
  have redis-cli || { echo ""; return; }
  if [ -n "$REDIS_PASSWORD" ]; then
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning "$@" 2>/dev/null
  else
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" "$@" 2>/dev/null
  fi
}

# ── CSV header ────────────────────────────────────────────────────────────────
echo "ts,cpu_pct,mem_pct,mem_used_mb,load1,disk_pct,net_rx_kbps,net_tx_kbps,pm2_cpu,pm2_mem_mb,pm2_restarts,pg_conn,pg_active,pg_waiting,pg_locks,pg_max_conn,redis_mem_mb,redis_clients,redis_ops,bull_waiting,bull_active,bull_failed" > "$OUT"

# Baselines for deltas
read -r _ pu pn ps pi _ < /proc/stat 2>/dev/null || { pu=0; pn=0; ps=0; pi=0; }
prev_idle=$pi; prev_total=$((pu+pn+ps+pi))
read -r prev_rx prev_tx < <(awk -F'[: ]+' 'NR>2{rx+=$3; tx+=$11} END{print rx" "tx}' /proc/net/dev 2>/dev/null || echo "0 0")

secs=0
while [ "$RUN" -eq 1 ]; do
  ts="$(date +%s)"

  # CPU% from /proc/stat delta
  read -r _ u n s i rest < /proc/stat
  total=$((u+n+s+i)); dt=$((total-prev_total)); di=$((i-prev_idle))
  cpu=0; [ "$dt" -gt 0 ] && cpu=$(( (100*(dt-di)) / dt ))
  prev_total=$total; prev_idle=$i

  # Memory
  mem_used_mb=""; mem_pct=""
  if have free; then
    read -r mem_total mem_used < <(free -m | awk '/^Mem:/{print $2" "$3}')
    mem_used_mb="$mem_used"
    [ "${mem_total:-0}" -gt 0 ] && mem_pct=$(( 100*mem_used/mem_total ))
  fi

  load1="$(awk '{print $1}' /proc/loadavg 2>/dev/null)"
  disk_pct="$(df -P / 2>/dev/null | awk 'END{gsub("%","",$5); print $5}')"

  # Net throughput (kB/s over the ~1s interval)
  read -r rx tx < <(awk -F'[: ]+' 'NR>2{r+=$3; t+=$11} END{print r" "t}' /proc/net/dev)
  net_rx=$(( (rx-prev_rx)/1024 )); net_tx=$(( (tx-prev_tx)/1024 ))
  prev_rx=$rx; prev_tx=$tx

  # PM2 (cpu%, mem MB, restarts) summed across PM2_PROCS
  pm2_cpu=""; pm2_mem=""; pm2_restarts=""
  if have pm2; then
    read -r pm2_cpu pm2_mem pm2_restarts < <(
      pm2 jlist 2>/dev/null | node -e '
        let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
          let a=[];try{a=JSON.parse(d)}catch{};
          const want=(process.env.PM2_PROCS||"").split(/\s+/).filter(Boolean);
          let cpu=0,mem=0,r=0;
          for(const p of a){ if(!want.length||want.includes(p.name)){
            cpu+=(p.monit?.cpu||0); mem+=(p.monit?.memory||0); r+=(p.pm2_env?.restart_time||0);}}
          console.log(`${cpu} ${Math.round(mem/1048576)} ${r}`);
        });' 2>/dev/null || echo "  "
    )
  fi

  # Postgres
  pg_conn="$(psql_q "SELECT count(*) FROM pg_stat_activity;")"
  pg_active="$(psql_q "SELECT count(*) FROM pg_stat_activity WHERE state='active';")"
  pg_waiting="$(psql_q "SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock';")"
  pg_locks="$(psql_q "SELECT count(*) FROM pg_locks WHERE NOT granted;")"
  pg_max="$(psql_q "SHOW max_connections;")"

  # Redis
  redis_mem=""; redis_clients=""; redis_ops=""
  if have redis-cli; then
    info="$(redis_cmd INFO 2>/dev/null)"
    redis_mem="$(printf '%s' "$info" | awk -F: '/used_memory:/{printf "%d", $2/1048576}')"
    redis_clients="$(printf '%s' "$info" | awk -F: '/connected_clients:/{gsub(/\r/,"",$2); print $2}')"
    redis_ops="$(printf '%s' "$info" | awk -F: '/instantaneous_ops_per_sec:/{gsub(/\r/,"",$2); print $2}')"
  fi

  # BullMQ backlog (sum of bull:<queue>:wait / :active / :failed lengths)
  bw=0; ba=0; bf=0
  if have redis-cli; then
    for q in $BULLMQ_QUEUES; do
      w="$(redis_cmd LLEN "bull:$q:wait")"; a="$(redis_cmd LLEN "bull:$q:active")"
      f="$(redis_cmd ZCARD "bull:$q:failed")"
      bw=$(( bw + ${w:-0} )); ba=$(( ba + ${a:-0} )); bf=$(( bf + ${f:-0} ))
    done
  fi

  echo "$ts,$cpu,${mem_pct},${mem_used_mb},${load1},${disk_pct},${net_rx},${net_tx},${pm2_cpu},${pm2_mem},${pm2_restarts},${pg_conn},${pg_active},${pg_waiting},${pg_locks},${pg_max},${redis_mem},${redis_clients},${redis_ops},${bw},${ba},${bf}" >> "$OUT"

  secs=$((secs+1))
  [ "$MAX_SECONDS" -gt 0 ] && [ "$secs" -ge "$MAX_SECONDS" ] && break
  sleep 1
done

echo "🛑 Monitor stopped after ${secs}s → $OUT"
