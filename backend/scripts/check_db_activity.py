#!/usr/bin/env python3
from psycopg import connect
from psycopg.rows import dict_row

DB = {"host":"localhost","port":5432,"dbname":"gharka_chef","user":"postgres","password":"postgres123"}

def main():
    conn = connect(**DB, row_factory=dict_row)
    cur = conn.cursor()
    print("Long running queries (top 10):")
    cur.execute(
        "SELECT pid, now()-query_start AS runtime, state, query FROM pg_stat_activity WHERE state <> 'idle' ORDER BY runtime DESC LIMIT 10"
    )
    for r in cur.fetchall():
        print(r)

    print("\\nActive locks:")
    cur.execute(
        "SELECT pid, relation::regclass, mode, granted FROM pg_locks pl LEFT JOIN pg_class pc ON pl.relation = pc.oid WHERE NOT pm IS NULL OR TRUE LIMIT 20"
    )
    for r in cur.fetchall():
        print(r)

    cur.close(); conn.close()

if __name__ == '__main__':
    main()

