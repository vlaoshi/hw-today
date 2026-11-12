// ===== 내 컴퓨터에서 실행하는 서버 =====
// 실행: npm start (또는 node local-server.js)  →  http://localhost:3000
//
// 배포(Vercel)에서는 api/ 폴더의 함수가 쓰이고, 이 파일은 쓰이지 않아요.
// 두 쪽 모두 lib/handlers.js의 같은 코드를 써서 똑같이 동작해요.
// Node.js 기본 기능만 써서 따로 설치할 패키지가 없어요. (Node 20.12 이상 필요)

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { artSearch, artImage, translate } from "./lib/handlers.js";

const PORT = 3000;
const ROOT = import.meta.dirname; // 이 파일이 있는 폴더

// .env 파일에서 Azure 번역 키를 읽어와요 (파일이 없으면 번역만 꺼져요)
try {
  process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  console.warn("⚠️  .env 파일이 없어서 번역 기능이 꺼져 있어요. (.env.example 참고)");
}

// 주소별로 어떤 기능을 쓸지 정해요 (Vercel의 api/ 폴더 구조와 같아요)
const API_ROUTES = {
  "/api/art/search": artSearch,
  "/api/art/image": artImage,
  "/api/translate": translate,
};

// 파일 확장자별 형식
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

// Node의 요청(req)을 웹 표준 Request로 바꿔서 기능을 실행하고, 결과를 돌려줘요
async function handleApi(handler, req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

  const request = new Request(`http://${req.headers.host}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body,
  });

  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

// 웹페이지 파일(html, css, js)을 보여줘요
async function handleStatic(pathname, res) {
  const requestPath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = path.join(ROOT, requestPath);
  const contentType = CONTENT_TYPES[path.extname(filePath)];

  // 이 폴더 밖의 파일이나, html·css·js가 아닌 파일은 보여주지 않아요
  if (!filePath.startsWith(ROOT + path.sep) || !contentType) {
    res.writeHead(404).end("찾을 수 없어요");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(file);
  } catch {
    res.writeHead(404).end("찾을 수 없어요");
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  try {
    const handler = API_ROUTES[pathname];
    if (handler) {
      await handleApi(handler, req, res);
    } else {
      await handleStatic(pathname, res);
    }
  } catch (error) {
    console.error("[서버 오류]", error);
    if (!res.headersSent) res.writeHead(502);
    res.end("중계 중 오류가 났어요");
  }
});

// 127.0.0.1로 열어서 이 컴퓨터에서만 접속할 수 있게 해요
server.listen(PORT, "127.0.0.1", () => {
  console.log(`오늘의 명언과 명화 → http://localhost:${PORT}`);
  console.log("끝내려면 Ctrl + C를 누르세요.");
});
