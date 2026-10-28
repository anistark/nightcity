# Serve the whole project, or one folder: `just serve pixel-city`
# Missing paths get the folder's 404.html when it has one, like static hosts do.
serve dir="." port="8765":
    #!/usr/bin/env python3
    import functools, http.server, os
    root = os.path.abspath("{{dir}}")
    class Handler(http.server.SimpleHTTPRequestHandler):
        extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".webmanifest": "application/manifest+json"}
        def end_headers(self):
            # Revalidate on every load, so edits show up without a hard reload.
            self.send_header("Cache-Control", "no-cache")
            super().end_headers()
        def send_error(self, code, message=None, explain=None):
            page = os.path.join(root, "404.html")
            if code != 404 or not os.path.isfile(page):
                return super().send_error(code, message, explain)
            body = open(page, "rb").read()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
    print("Serving {{dir}} at http://localhost:{{port}}", flush=True)
    http.server.ThreadingHTTPServer(("", {{port}}), functools.partial(Handler, directory=root)).serve_forever()
