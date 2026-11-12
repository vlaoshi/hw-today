// Netlify 서버 함수: GET /api/art/search (실제 내용은 lib/handlers.js에 있어요)
import { artSearch } from "../../lib/handlers.js";

export default (request) => artSearch(request);

// 이 함수를 연결할 주소
export const config = { path: "/api/art/search" };
