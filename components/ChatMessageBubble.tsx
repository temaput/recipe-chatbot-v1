import { cn } from "@/utils/cn";
import type { Message } from "ai/react";

export function ChatMessageBubble(props: {
  message: Message;
  aiEmoji?: string;
  sources: any[];
}) {
  return (
    <div
      className={cn(
        `rounded-3xl max-w-[80%] mb-8 flex transition-all duration-200`,
        props.message.role === "user"
          ? "bg-gradient-to-br from-honey-100 to-honey-200 text-warmBrown-800 px-6 py-3 shadow-md border border-honey-300"
          : null,
        props.message.role === "user" ? "ml-auto" : "mr-auto",
      )}
    >
      {props.message.role !== "user" && (
        <div className="mr-4 border-2 border-sage-300 bg-gradient-to-br from-sage-100 to-sage-200 -mt-2 rounded-full w-12 h-12 flex-shrink-0 flex items-center justify-center shadow-md text-lg">
          {props.aiEmoji || "👵"}
        </div>
      )}

      <div className="whitespace-pre-wrap flex flex-col">
        <span>{props.message.content}</span>

        {props.sources && props.sources.length ? (
          <>
            <div className="mt-4 mr-auto bg-gradient-to-r from-sage-400 to-sage-500 text-cream-50 px-3 py-2 rounded-xl shadow-sm">
              <h2 className="text-sm font-medium">📚 Recipe Sources:</h2>
            </div>
            <div className="mt-2 mr-2 bg-gradient-to-br from-cream-100 to-cream-200 border border-sage-200 px-3 py-2 rounded-xl text-xs text-warmBrown-700 shadow-sm">
              {props.sources?.map((source, i) => (
                <div className="mt-2 first:mt-0" key={"source:" + i}>
                  <span className="font-medium text-terracotta-600">{i + 1}.</span> &quot;{source.pageContent}&quot;
                  {source.metadata?.loc?.lines !== undefined ? (
                    <div className="text-sage-600 mt-1">
                      <br />
                      Lines {source.metadata?.loc?.lines?.from} - {source.metadata?.loc?.lines?.to}
                    </div>
                  ) : (
                    ""
                  )}
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
