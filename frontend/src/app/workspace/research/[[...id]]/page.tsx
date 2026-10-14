import { redirect } from "next/navigation";

/** `/workspace/research` and `/workspace/research/{id}` are one review page. */
export default function ResearchReviewPage() {
  redirect("/workspace/submissions");
}
