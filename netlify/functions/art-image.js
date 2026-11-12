// Netlify 서버 함수: GET /api/art/image?id=... (실제 내용은 lib/handlers.js에 있어요)
import { artImage } from "../../lib/handlers.js";

export default (request) => artImage(request);

// 이 함수를 연결할 주소
export const config = { path: "/api/art/image" };
