import { createEnscribeApp } from '../server/app.js';

const runtime = createEnscribeApp();

export default function handler(req: any, res: any) {
  return runtime.app(req, res);
}
