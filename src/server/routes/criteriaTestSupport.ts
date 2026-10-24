// Fictional HTTP fixtures only. No database, external publisher or model calls.
import { after } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import type { Router } from "express";
import { errorHandler } from "./errors.ts";
import { MemoryCriteriaStore, emptyPublicState } from "../trends/snapshotStore.ts";
import { createCriteriaContextLoader } from "../trends/context.ts";
import { bundle, NOW } from "../trends/testFixtures.ts";
import type { CriteriaBundle } from "../contracts/trends.ts";

const servers: Server[] = [];
after(() => servers.forEach((server) => server.close()));

export async function startApp(...routers: Router[]): Promise<string> {
  const app = express();
  for (const router of routers) app.use(router);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

export async function request(base: string, path: string, body?: unknown) {
  const response = await fetch(`${base}${path}`, body === undefined ? undefined : {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

export async function criteriaHarness(initial: CriteriaBundle = bundle(2)) {
  let now = Date.parse(NOW);
  const store = new MemoryCriteriaStore({ now: () => now });
  const id = await store.bootstrap(initial);
  const loadContext = createCriteriaContextLoader({ store, disabled: true, now: () => now });
  const loadSnapshot = store.readSnapshot.bind(store);
  return { store, id, loadContext, loadSnapshot, async publish(next: CriteriaBundle) {
    now += 76_000;
    const reservation = await store.reserveRefresh();
    if (reservation.status !== "acquired") throw new Error("Fixture reservation failed.");
    const result = await store.publishIfCurrent(reservation.baseSnapshotId, reservation.generation, next, emptyPublicState(), true);
    await store.releaseRefresh(reservation.generation);
    return result.snapshot!.id;
  } };
}
