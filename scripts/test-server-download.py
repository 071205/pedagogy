"""HWPX responses stay downloads, including hostile text inside converter output.

Uses real HTTP and stub converters so it runs without lxml or private templates.
"""
import http.client
import importlib.util
import io
import json
from pathlib import Path
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("pedagogy_server", ROOT / "serve.py")
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class DownloadTests(unittest.TestCase):
    def test_downloads_and_error_boundary(self):
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w") as zf:
            zf.writestr("Contents/section0.xml", "<script>alert(1)</script>")
        payload = archive.getvalue()

        def build(_request, output, **_kwargs):
            output.write_bytes(payload)
            return SimpleNamespace(warnings=["sample"])

        converter = SimpleNamespace(build=build, DocumentValidationError=ValueError)
        httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()

        def post(route, *, allowed=True):
            connection = http.client.HTTPConnection(*httpd.server_address, timeout=5)
            headers = {"Content-Type": "application/json"}
            if allowed:
                headers["X-Exam-Client"] = "1"
            connection.request("POST", route, json.dumps({"problems": [{}], "document": {}}), headers)
            response = connection.getresponse()
            result = response.status, dict(response.getheaders()), response.read()
            connection.close()
            return result

        try:
            with patch.object(server, "load_hwpx", return_value=(converter, None)), \
                    patch.object(server, "load_document_hwpx", return_value=(converter, None)):
                for route, filename in [("/hwpx", "exam.hwpx"), ("/document-hwpx", "document.hwpx")]:
                    with self.subTest(route=route):
                        status, headers, body = post(route)
                        self.assertEqual(status, 200)
                        self.assertEqual(headers["Content-Type"], "application/vnd.hancom.hwpx")
                        self.assertEqual(headers.get("Content-Disposition"), f'attachment; filename="{filename}"')
                        self.assertEqual(headers.get("X-Content-Type-Options"), "nosniff")
                        self.assertEqual(headers.get("Cache-Control"), "no-store")
                        self.assertEqual(headers.get("Referrer-Policy"), "no-referrer")
                        self.assertEqual(headers["X-Hwpx-Warnings"], "1")
                        self.assertEqual(int(headers["Content-Length"]), len(payload))
                        self.assertEqual(body, payload, "Do not HTML-escape a binary ZIP download")
                        self.assertEqual(post(route, allowed=False)[0], 403)

                with patch.object(converter, "build", side_effect=RuntimeError("private/server/path")):
                    for route in ("/hwpx", "/document-hwpx"):
                        status, _headers, body = post(route)
                        self.assertEqual(status, 500)
                        self.assertNotIn(b"private/server/path", body)
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
