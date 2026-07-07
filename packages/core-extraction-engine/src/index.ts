import type { ExtractionRun, ApiGraph } from "@api-catalog/contracts";
import * as fs from "fs";
import { registerParser, getParser } from "@api-catalog/parser-registry";
import { validate } from "@api-catalog/validation-engine";
import { computeQualityGate } from "@api-catalog/quality-gates";
import { InMemoryEvidenceLedger } from "@api-catalog/evidence-ledger";
import { buildGraph } from "@api-catalog/canonical-graph";
import { InMemoryExtractionRunTracker } from "@api-catalog/extraction-run-tracker";
import { generateOpenApi } from "@api-catalog/generator-openapi";
import { ExpressParser } from "@api-catalog/parser-express";
import type { OpenApiDocument } from "@api-catalog/generator-openapi";

registerParser("express", ExpressParser);

export interface ExtractionEngineInput {
  repositoryUrl: string;
  commitSha: string;
  parserName: string;
  localRepoPath: string;
  hostUrl?: string;
  apiName?: string;
}

export interface ExtractionEngineOutput {
  run: ExtractionRun;
  graph: ApiGraph;
  openApiDocument: OpenApiDocument;
}

export async function runExtraction(input: ExtractionEngineInput): Promise<ExtractionEngineOutput> {
  const { repositoryUrl, commitSha, parserName, localRepoPath, apiName } = input;

  if (!fs.existsSync(localRepoPath)) {
    throw new Error("Repository path does not exist: " + localRepoPath);
  }

  const tracker = new InMemoryExtractionRunTracker();
  const ledger = new InMemoryEvidenceLedger();

  let run = await tracker.create({ repositoryUrl, commitSha, parserName, parserVersion: "1.0.0" });
  run = await tracker.transition(run.id, "running");

  const parser = getParser(parserName as "express" | "fastapi" | "spring");
  if (!parser) {
    run = await tracker.transition(run.id, "parser_error");
    throw new Error("No parser registered for framework: " + parserName);
  }

  let extractionResult;
  try {
    extractionResult = await parser.parse(localRepoPath, commitSha);
  } catch (err: unknown) {
    run = await tracker.transition(run.id, "parser_error");
    throw new Error("Parser error: " + (err as Error).message);
  }

  if (extractionResult.errors.length > 0 && extractionResult.routes.length === 0) {
    run = await tracker.transition(run.id, "parser_error");
    throw new Error("Parser produced only errors and no routes");
  }

  const validationSummary = validate(extractionResult);
  run = await tracker.setValidationSummary(run.id, validationSummary);
  if (!validationSummary.passed) {
    run = await tracker.transition(run.id, "validation_failed");
    throw new Error("Validation failed: " + validationSummary.errors.map((e) => e.message).join("; "));
  }

  const qualityReport = computeQualityGate({ extractionResult, validationSummary });
  qualityReport.extractionRunId = run.id;
  const gateOutcome = {
    totalEndpoints: qualityReport.endpointScores.length,
    autoAccepted: 0,
    reviewRequired: qualityReport.endpointScores.filter((s) => s.outcome === "human-review-required").length,
    rejected: qualityReport.endpointScores.filter((s) => s.outcome === "reject").length,
  };
  run = await tracker.setGateOutcome(run.id, gateOutcome);

  if (qualityReport.overallOutcome === "reject") {
    run = await tracker.transition(run.id, "quality_gate_failed");
    throw new Error("Quality gate: extraction rejected");
  }

  for (const route of extractionResult.routes) {
    const epId = run.id + ":" + route.method + ":" + route.path;
    await ledger.append({ extractionRunId: run.id, endpointId: epId, field: "route", value: { method: route.method, path: route.path }, source: "parser", verificationStatus: "unverified" });
  }

  const resolvedApiName = apiName ?? repositoryUrl.split("/").pop() ?? "unknown";
  const graph = buildGraph(repositoryUrl, resolvedApiName, extractionResult, new Map(), run.id);
  const openApiDocument = generateOpenApi(graph);
  run = await tracker.transition(run.id, "review_required");
  return { run, graph, openApiDocument };
}
