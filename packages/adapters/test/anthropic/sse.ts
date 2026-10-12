/**
 * Replays a recorded Messages API response as the server-sent events the
 * streaming endpoint emits, so the SDK's real stream parser is exercised.
 */
interface RecordedBlock {
  readonly type: string;
  readonly text?: string;
  readonly thinking?: string;
  readonly signature?: string;
}

interface RecordedMessage {
  readonly content: readonly RecordedBlock[];
  readonly stop_reason: string;
  readonly stop_sequence: string | null;
  readonly stop_details?: unknown;
  readonly usage: { readonly input_tokens: number; readonly output_tokens: number };
}

const event = (type: string, data: Record<string, unknown>) =>
  `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;

const blockEvents = (block: RecordedBlock, index: number): string[] => {
  if (block.type === "text") {
    return [
      event("content_block_start", { index, content_block: { type: "text", text: "" } }),
      event("content_block_delta", { index, delta: { type: "text_delta", text: block.text } }),
      event("content_block_stop", { index }),
    ];
  }
  if (block.type === "thinking") {
    return [
      event("content_block_start", {
        index,
        content_block: { type: "thinking", thinking: "", signature: "" },
      }),
      event("content_block_delta", {
        index,
        delta: { type: "signature_delta", signature: block.signature },
      }),
      event("content_block_stop", { index }),
    ];
  }
  return [
    event("content_block_start", { index, content_block: block }),
    event("content_block_stop", { index }),
  ];
};

export const sse = (message: RecordedMessage): string =>
  [
    event("message_start", {
      message: {
        ...message,
        content: [],
        stop_reason: null,
        usage: { ...message.usage, output_tokens: 0 },
      },
    }),
    ...message.content.flatMap(blockEvents),
    event("message_delta", {
      delta: {
        stop_reason: message.stop_reason,
        stop_sequence: message.stop_sequence,
        ...(message.stop_details === undefined ? {} : { stop_details: message.stop_details }),
      },
      usage: { output_tokens: message.usage.output_tokens },
    }),
    event("message_stop", {}),
  ].join("");
