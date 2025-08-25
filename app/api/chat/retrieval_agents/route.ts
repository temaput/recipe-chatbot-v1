import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
} from "@langchain/core/messages";
import { graph as agent } from "./agent";

export const runtime = "edge";

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

const convertLangChainMessageToVercelMessage = (message: BaseMessage) => {
  if (message._getType() === "human") {
    return { content: message.content, role: "user" };
  } else if (message._getType() === "ai") {
    return {
      content: message.content,
      role: "assistant",
      tool_calls: (message as AIMessage).tool_calls,
    };
  } else {
    return { content: message.content, role: message._getType() };
  }
};

/**
 * This handler initializes and calls an tool caling ReAct agent.
 * See the docs for more information:
 *
 * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
 * https://js.langchain.com/docs/use_cases/question_answering/conversational_retrieval_agents
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const threadId = body.threadId;
    /**
     * We represent intermediate steps as system messages for display purposes,
     * but don't want them in the chat history.
     */
    const messages = (body.messages ?? [])
      .filter(
        (message: VercelChatMessage) =>
          message.role === "user" || message.role === "assistant",
      )
      .map(convertVercelMessageToLangChainMessage);

    /**
     * Wrap the retriever in a tool to present it to the agent in a
     * usable form.
     */

    /**
     * Stream back all generated tokens and steps from their runs.
     *
     * We do some filtering of the generated events and only stream back
     * the final response as a string.
     *
     * For this specific type of tool calling ReAct agents with OpenAI, we can tell when
     * the agent is ready to stream back final output when it no longer calls
     * a tool and instead streams back content.
     *
     * See: https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/
     */
    const eventStream = await agent.streamEvents(
      {
        messages,
      },
      { version: "v2", configurable: { thread_id: threadId } },
    );

    const textEncoder = new TextEncoder();
    const transformStream = new ReadableStream({
      async start(controller) {
        for await (const { event, data } of eventStream) {
          if (event === "on_chat_model_stream") {
            // Intermediate chat model generations will contain tool calls and no content
            if (!!data.chunk.content) {
              controller.enqueue(textEncoder.encode(data.chunk.content));
            }
          }
        }
        controller.close();
      },
    });

    return new StreamingTextResponse(transformStream);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
