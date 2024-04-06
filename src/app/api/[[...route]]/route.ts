import { Redis } from "@upstash/redis/cloudflare";
import { Hono } from "hono";
import { env } from "hono/adapter";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";

export const runtime = "edge";

const app = new Hono().basePath("/api");

type EnvConfig = {
  UPSTASH_REDIS_URL: string;
  UPSTASH_REDIS_TOKEN: string;
};

app.use('/*', cors())

app.get("/search", async (c) => {
  try {
    const { UPSTASH_REDIS_TOKEN, UPSTASH_REDIS_URL } = env<EnvConfig>(c);

    const start = performance.now();

    const redis = new Redis({
      token: UPSTASH_REDIS_TOKEN,
      url: UPSTASH_REDIS_URL,
    });

    const query = c.req.query("q")?.toUpperCase();

    if (!query) {
      return c.json({ message: "Invalid search query" }, { status: 400 });
    }

    const res = [];
    const rank = await redis.zrank("terms", query);

    if (rank !== null && rank !== undefined) {
      const temp = await redis.zrange<string[]>("terms", rank, rank + 200);

      for (const el of temp) {
        if (!el.startsWith(query)) {
          break;
        }
        if (el.endsWith("*")) {
          res.push(el.substring(0, el.length - 1));
        }
      }
    }

    const end = performance.now();

    return c.json({
      results: res,
      durations: end - start,
    });
  } 
  catch (error) {
    console.log(error);
    return c.json(
      { results: [], message: "Something went wrong" },
      {
        status: 500,
      }
    );
  }
});

export const GET = handle(app);
export default app as never;
