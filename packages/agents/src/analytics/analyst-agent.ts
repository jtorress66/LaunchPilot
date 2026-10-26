import { err, ok, type Result } from "@nuvantre/domain";
import type {
  Analysis,
  AnalysisError,
  AnalysisRequest,
  LlmClient,
  LlmError,
  LlmMessage,
  WeeklyReportAnalyst,
} from "@nuvantre/ports";
import { notesProblems } from "./notes-rules";
import { ANALYST_SYSTEM_PROMPT, analystUserMessage, rewriteMessage } from "./prompt";
import { notesAnswer, notesAnswerJsonSchema, type NotesAnswer } from "./schema";

const MAX_TOKENS = 2_000;

const failed = (message: string, retryable = true): AnalysisError => ({
  code: "analysis_failed",
  message,
  retryable,
});

/** Outages are worth retrying; anything the model or API refused is a failed analysis. */
const fromLlmError = (error: LlmError): AnalysisError =>
  error.code === "rate_limited" || error.code === "unavailable"
    ? { code: "unavailable", message: error.message, retryable: true }
    : failed(error.message, false);

const parseAnswer = (text: string): Result<NotesAnswer, AnalysisError> => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return err(failed("The model did not answer with JSON"));
  }
  const parsed = notesAnswer.safeParse(json);
  return parsed.success
    ? ok(parsed.data)
    : err(failed("The model's answer did not match the notes format"));
};

const toAnalysis = (answer: NotesAnswer, request: AnalysisRequest): Analysis => ({
  summary: answer.summary.trim(),
  highlights: answer.highlights.map((h) => h.trim()).filter((h) => h !== ""),
  suggestions: answer.suggestions.map((s) => s.trim()).filter((s) => s !== ""),
  citedFacts: answer.citedFacts.filter((fact) => request.brief?.facts.includes(fact) ?? false),
});

/** Writes the notes on a weekly report. Analysis only: every figure it states is checked. */
export class AnalystAgent implements WeeklyReportAnalyst {
  constructor(private readonly llm: LlmClient) {}

  async analyse(request: AnalysisRequest): Promise<Result<Analysis, AnalysisError>> {
    const messages: LlmMessage[] = [{ role: "user", content: analystUserMessage(request) }];
    const first = await this.ask(messages);
    if (!first.ok) return first;
    const analysis = toAnalysis(first.value, request);
    const problems = notesProblems(request.report, analysis);
    if (problems.length === 0) return ok(analysis);

    // One rewrite: told exactly which figures are not in the report, models drop them.
    const second = await this.ask([
      ...messages,
      { role: "assistant", content: JSON.stringify(first.value) },
      { role: "user", content: rewriteMessage(problems) },
    ]);
    if (!second.ok) return second;
    const rewritten = toAnalysis(second.value, request);
    const remaining = notesProblems(request.report, rewritten);
    return remaining.length === 0
      ? ok(rewritten)
      : err(failed(`The notes still break the rules: ${remaining.join(" ")}`));
  }

  private async ask(messages: readonly LlmMessage[]): Promise<Result<NotesAnswer, AnalysisError>> {
    const response = await this.llm.complete({
      system: ANALYST_SYSTEM_PROMPT,
      messages,
      maxTokens: MAX_TOKENS,
      responseFormat: { type: "json_schema", schema: notesAnswerJsonSchema },
    });
    if (!response.ok) return err(fromLlmError(response.error));
    if (response.value.stopReason === "max_tokens") {
      return err(failed("The notes were cut off before they finished"));
    }
    return parseAnswer(response.value.text);
  }
}
