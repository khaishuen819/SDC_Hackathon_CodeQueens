import express from "express";
import { apiRouter } from "./src/server/routes/index.ts";

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(apiRouter);

// Frontend (M1): static files, after the API so they can never replace an /api route.
app.use(express.static("frontend/public"));

app.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
