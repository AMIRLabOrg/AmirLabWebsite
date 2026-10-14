import { WorkspaceContent } from "@/components/workspace-content";
import type { Metadata } from "next";
import { WorkspaceChat } from "@/components/workspace-chat";

export const metadata: Metadata = { title: "Chat" };

export default function WorkspaceChatPage() {
  return (
    <WorkspaceContent>
      <section className="h-full min-h-0">
        <WorkspaceChat />
      </section>
    </WorkspaceContent>
  );
}
