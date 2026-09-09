import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export const defaultModelBaseUrl = "https://aidp-i18ntt-sg.tiktok-row.net";

interface GenieProxyOptions {
  apiKey?: string;
  baseUrl?: string;
}

interface GenieRequestBody {
  prompt?: string;
  imageDataUrl?: string;
}

class RequestError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

async function readJsonBody(
  request: IncomingMessage,
): Promise<GenieRequestBody> {
  const chunks: Buffer[] = [];
  let byteLength = 0;

  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    byteLength += buffer.length;
    if (byteLength > 1_000_000) {
      throw new RequestError(413, "请求内容过大。");
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString()) as GenieRequestBody;
  } catch {
    throw new RequestError(400, "请求格式无效。");
  }
}

export async function handleGenieChat(
  request: IncomingMessage,
  response: ServerResponse,
  options: GenieProxyOptions,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  if (!options.apiKey) {
    sendJson(response, 503, {
      error: "未配置 GENIE_MODEL_AK，请检查 Goofy 运行时环境变量。",
    });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const prompt = body.prompt?.trim();
    if (!prompt) throw new RequestError(400, "Prompt is required");
    if (prompt.length > 50_000)
      throw new RequestError(413, "Prompt is too long");

    const imageDataUrl =
      typeof body.imageDataUrl === "string" &&
      /^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(body.imageDataUrl) &&
      body.imageDataUrl.length <= 800_000
        ? body.imageDataUrl
        : undefined;
    const content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [{ type: "text", text: prompt }];

    if (imageDataUrl) {
      content.push({
        type: "image_url",
        image_url: { url: imageDataUrl },
      });
    }

    const baseUrl = options.baseUrl || defaultModelBaseUrl;
    const upstream = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/modelhub/online/v2/crawl?ak=${encodeURIComponent(options.apiKey)}`,
      {
        method: "POST",
        signal: AbortSignal.timeout(60_000),
        headers: {
          "Content-Type": "application/json",
          "X-TT-LOGID": randomUUID(),
        },
        body: JSON.stringify({
          stream: false,
          model: "gpt-5.4-2026-03-05",
          max_tokens: 500,
          messages: [{ role: "user", content }],
        }),
      },
    );

    const payload = await upstream.json();
    sendJson(response, upstream.status, payload);
  } catch (error) {
    if (error instanceof RequestError) {
      sendJson(response, error.statusCode, { error: error.message });
      return;
    }

    sendJson(response, 502, {
      error: error instanceof Error ? error.message : "Genie 请求失败。",
    });
  }
}
