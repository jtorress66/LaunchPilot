"use client";

import { useActionState } from "react";
import { draftArticleAction, type SeoActionState } from "../../app/_lib/seo-actions";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";

export function DraftArticleButton({
  taskId,
  keyword,
}: {
  readonly taskId: string;
  readonly keyword: string;
}) {
  const [state, action] = useActionState<SeoActionState>(draftArticleAction.bind(null, taskId), {});
  return (
    <form action={action} className="space-y-2" aria-label={`Draft the article for ${keyword}`}>
      <SubmitButton pending="Writing…">Draft article</SubmitButton>
      <FormError message={state.errors?.form} />
    </form>
  );
}
