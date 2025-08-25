import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";

export default function AgentsPage() {
  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li>
          👵
          <span className="ml-2">
            Welcome to Grandma&apos;s Recipe Collection! I&apos;m here to help you create delicious, homemade meals with love and tradition.
          </span>
        </li>
        <li className="text-l">
          🥕
          <span className="ml-2">
            Tell me what ingredients you have, any dietary restrictions, and I&apos;ll help you cook something delicious! Try asking:{" "}
            <code>&quot;I have chicken, potatoes, and herbs - what can I make?&quot;</code>{" "}
            or <code>&quot;Show me a vegetarian comfort food recipe&quot;</code>
          </span>
        </li>
      </ul>
    </GuideInfoBox>
  );

  return (
    <ChatWindow
      endpoint="api/chat/retrieval_agents"
      emptyStateComponent={InfoCard}
      // showIngestForm={true}
      showIntermediateStepsToggle={false}
      placeholder={
        'Hello, dear! I\'m your cooking grandma. Ask me about your favorite recipes: "How to make homemade bread?" or "Share a secret for delicious jam!"'
      }
      emoji="👵"
    />
  );
}
