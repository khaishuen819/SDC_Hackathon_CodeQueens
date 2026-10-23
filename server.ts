import express from "express";
import { apiRouter } from "./src/server/routes/index.ts";

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(apiRouter);

app.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
