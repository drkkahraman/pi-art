#!/usr/bin/env python3
"""
Pi Art & Infinite Visualizer SQLite Backend Server
Serves static frontend and provides SQLite persistence for Pi calculations.
"""

import os
import sys
import json
import sqlite3
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pi_storage.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pi_chunks (
            chunk_id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_idx INTEGER NOT NULL,
            length INTEGER NOT NULL,
            digits TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pi_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_start_idx ON pi_chunks(start_idx)")
    conn.commit()
    conn.close()

class PiServerHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent caching for live APIs and development
        if self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/load":
            self.handle_api_load()
        elif parsed.path == "/api/status":
            self.handle_api_status()
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/save":
            self.handle_api_save()
        elif parsed.path == "/api/reset":
            self.handle_api_reset()
        else:
            self.send_error(404, "API endpoint not found")

    def handle_api_load(self):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT start_idx, length, digits FROM pi_chunks ORDER BY start_idx ASC")
        rows = cursor.fetchall()
        
        all_digits = []
        total_len = 0
        for start_idx, length, digits in rows:
            all_digits.append(digits)
            total_len += length
        
        full_digits_str = "".join(all_digits)

        # Retrieve streamer_state if saved
        cursor.execute("SELECT value FROM pi_meta WHERE key = 'streamer_state'")
        meta_row = cursor.fetchone()
        streamer_state = json.loads(meta_row[0]) if meta_row and meta_row[0] else None

        conn.close()

        response = {
            "status": "ok",
            "total_digits": len(full_digits_str),
            "digits": full_digits_str,
            "streamer_state": streamer_state
        }
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(response).encode("utf-8"))

    def handle_api_status(self):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*), IFNULL(SUM(length), 0) FROM pi_chunks")
        chunk_count, total_digits = cursor.fetchone()
        conn.close()

        response = {
            "status": "ok",
            "total_digits": total_digits,
            "chunk_count": chunk_count,
            "db_path": DB_PATH
        }
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(response).encode("utf-8"))

    def handle_api_save(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))
            
            start_idx = int(data.get("start_idx", 0))
            digits = str(data.get("digits", ""))
            streamer_state = data.get("streamer_state")
            length = len(digits)

            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            if length > 0:
                cursor.execute("""
                    INSERT INTO pi_chunks (start_idx, length, digits)
                    VALUES (?, ?, ?)
                """, (start_idx, length, digits))

            if streamer_state is not None:
                cursor.execute("""
                    INSERT OR REPLACE INTO pi_meta (key, value)
                    VALUES ('streamer_state', ?)
                """, (json.dumps(streamer_state),))

            conn.commit()
            conn.close()

            response = {"status": "ok", "saved_length": length}
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode("utf-8"))
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))

    def handle_api_reset(self):
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM pi_chunks")
            cursor.execute("DELETE FROM pi_meta")
            conn.commit()
            conn.close()

            # Vacuum in autocommit connection
            v_conn = sqlite3.connect(DB_PATH, isolation_level=None)
            v_conn.execute("VACUUM")
            v_conn.close()

            response = {"status": "ok", "message": "SQLite database reset successfully"}
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode("utf-8"))
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))

if __name__ == "__main__":
    init_db()
    port = 8080
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    
    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, PiServerHandler)
    print(f"Pi Art SQLite Server running on http://localhost:{port} (DB: {DB_PATH})")
    httpd.serve_forever()
