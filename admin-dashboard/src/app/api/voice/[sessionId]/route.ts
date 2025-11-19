export const runtime = "edge";

type RouteContext = {
  params: {
    sessionId: string;
  };
};

declare const WebSocketPair: {
  new (): { 0: WebSocket; 1: WebSocket };
};

type WebSocketWithAccept = WebSocket & {
  accept?: () => void;
};

type UpgradeResponse = Response & {
  webSocket?: WebSocketWithAccept;
};

type WebSocketResponseInit = ResponseInit & {
  webSocket: WebSocketWithAccept;
};

type PendingMessage =
  | string
  | ArrayBuffer
  | ArrayBufferView
  | Blob;

function createWebSocketPair(): [WebSocketWithAccept, WebSocketWithAccept] {
  const pair = new WebSocketPair();
  return [pair[0] as WebSocketWithAccept, pair[1] as WebSocketWithAccept];
}

function closeWithError(socket: WebSocket, reason: string) {
  try {
    socket.close(1011, reason);
  } catch (err) {
    console.error("Error closing socket", err);
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  const backendBaseUrl =
    process.env.BACKEND_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

  if (!backendBaseUrl) {
    return new Response("BACKEND_API_BASE_URL is not configured", { status: 500 });
  }

  const normalizedBaseUrl = backendBaseUrl.replace(/\/$/, "");
  const { sessionId } = await context.params;
  const httpTargetUrl = `${normalizedBaseUrl}/ws/voice/${sessionId}`;

  const upstreamResponse = await fetch(httpTargetUrl, {
    headers: {
      upgrade: "websocket",
    },
  });

  const upgradedResponse = upstreamResponse as UpgradeResponse;
  const upstreamSocket = upgradedResponse.webSocket;

  if (upstreamResponse.status !== 101 || !upstreamSocket) {
    console.error("Upstream handshake failed", upstreamResponse.status, upstreamResponse.headers);
    return new Response("Failed to establish upstream WebSocket", { status: 502 });
  }

  upstreamSocket.accept?.();

  const [clientSocket, proxySocket] = createWebSocketPair();
  proxySocket.accept?.();

  let upstreamOpen = false;
  const pending: PendingMessage[] = [];

  upstreamSocket.addEventListener("open", () => {
    upstreamOpen = true;
    pending.forEach((message) => {
      try {
        upstreamSocket.send(message);
      } catch (err) {
        console.error("Failed to flush pending message", err);
      }
    });
    pending.length = 0;
  });

  upstreamSocket.addEventListener("message", (event: MessageEvent) => {
    try {
      proxySocket.send(event.data);
    } catch (err) {
      console.error("Failed to forward message to client", err);
      upstreamSocket.close(1011, "Client send failure");
    }
  });

  upstreamSocket.addEventListener("close", (event: CloseEvent) => {
    try {
      proxySocket.close(event.code, event.reason);
    } catch (err) {
      console.error("Failed to close client socket", err);
    }
  });

  upstreamSocket.addEventListener("error", (err: Event) => {
    console.error("Upstream WebSocket error", err);
    closeWithError(proxySocket, "Upstream error");
  });

  proxySocket.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as PendingMessage;
    if (upstreamOpen) {
      try {
        upstreamSocket.send(data);
      } catch (err) {
        console.error("Failed to forward message upstream", err);
        upstreamSocket.close(1011, "Forward failure");
      }
    } else {
      pending.push(data);
    }
  });

  proxySocket.addEventListener("close", (event: CloseEvent) => {
    try {
      upstreamSocket.close(event.code, event.reason);
    } catch (err) {
      console.error("Failed to close upstream socket", err);
    }
  });

  proxySocket.addEventListener("error", (err: Event) => {
    console.error("Client WebSocket error", err);
    upstreamSocket.close(1011, "Client error");
  });

  return new Response(null, { status: 101, webSocket: clientSocket } as WebSocketResponseInit);
}
