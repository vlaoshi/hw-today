// Netlify 서버 함수: POST /api/translate (실제 내용은 lib/handlers.js에 있어요)
import { translate } from "../../lib/handlers.js";

export default (request) => translate(request);

// 이 함수를 연결할 주소
export const config = { path: "/api/translate" };
