"""Dev server: static files with cache disabled, so code edits show up on a plain refresh."""
import http.server
import socketserver

PORT = 8741


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # keep the background log quiet


class ThreadingTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == '__main__':
    with ThreadingTCPServer(('0.0.0.0', PORT), NoCacheHandler) as httpd:
        print(f'serving on http://localhost:{PORT}/ (no cache)')
        httpd.serve_forever()
