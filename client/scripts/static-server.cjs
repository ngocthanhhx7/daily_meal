const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../dist");
const port = Number(process.env.PORT || 8090);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".xml": "application/xml; charset=utf-8"
};

http
  .createServer((req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const requested = decodeURIComponent(url.pathname);
    const filePath = path.join(root, requested === "/" ? "index.html" : requested);
    const resolved = filePath.startsWith(root) && fs.existsSync(filePath) ? filePath : path.join(root, "index.html");
    const ext = path.extname(resolved);

    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    fs.createReadStream(resolved).pipe(res);
  })
  .listen(port, () => {
    console.log(`Serving ${root} at http://localhost:${port}`);
  });
