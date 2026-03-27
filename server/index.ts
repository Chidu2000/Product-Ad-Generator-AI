import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
const app = createApp({ serveStatic: true });

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
