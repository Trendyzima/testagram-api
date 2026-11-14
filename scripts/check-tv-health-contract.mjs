import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const fail = [];
const backendRouter = read("source-repos/backend/cmd/api/main.go");
const backendTV = read("source-repos/backend/cmd/api/tv_health.go");
const backendTests = read("source-repos/backend/cmd/api/tv_health_test.go");
const backendMigration = read("source-repos/backend/migrations/20261106_tv_health_postgres.sql");
const flutterWorkflow = read("source-repos/flutter-client/.github/workflows/tv-health-monitor.yml");
const flutterMonitor = read("source-repos/flutter-client/tool/tv_health_monitor.mjs");
const publicSpec = read("contracts/openapi/testagram-v1.yaml");
const privateSpec = read("contracts/internal/openapi/backend-tv-health-monitor-v1.yaml");

for (const [label, source, marker] of [
  ["Backend router", backendRouter, 'HandleFunc("GET /internal/tv/catalog", s.tvCatalogRead)'],
  ["Backend router", backendRouter, 'HandleFunc("POST /internal/tv/health", s.tvHealthBatch)'],
  ["Backend TV handler", backendTV, 'githubOIDCAudience = "testagram-tv-health"'],
  ["Backend TV handler", backendTV, 'tvHealthRepository = "Trendyzima/testagram-flutter-client-"'],
  ["Backend TV handler", backendTV, 'tvHealthWorkflow   = "Testagram TV Health Monitor"'],
  ["Backend TV handler", backendTV, 'r.Header.Get("X-GitHub-OIDC-Token")'],
  ["Backend TV handler", backendTV, "verifyTVGitHubOIDCToken"],
  ["Backend TV migration", backendMigration, "CREATE TABLE IF NOT EXISTS testagram_tv.channel_health"],
  ["Flutter workflow", flutterWorkflow, "id-token: write"],
  ["Flutter workflow", flutterWorkflow, "audience=testagram-tv-health"],
  ["Flutter monitor", flutterMonitor, "/internal/tv/catalog"],
  ["Flutter monitor", flutterMonitor, "/internal/tv/health"],
  ["Flutter monitor", flutterMonitor, '"x-github-oidc-token": oidcToken'],
  ["Backend tests", backendTests, "TestTVCatalogRouteRequiresAuthorizedWorkflowIdentity"],
  ["Backend tests", backendTests, "TestTVHealthRouteRequiresAuthorizedWorkflowIdentity"],
  ["Backend tests", backendTests, "TestVerifyTVGitHubOIDCTokenRejectsWrongWorkflowClaims"],
  ["Private TV OpenAPI", privateSpec, "/internal/tv/catalog:"],
  ["Private TV OpenAPI", privateSpec, "/internal/tv/health:"],
  ["Private TV OpenAPI", privateSpec, "X-GitHub-OIDC-Token"],
]) {
  if (!source.includes(marker)) fail.push(label + " missing contract marker: " + marker);
}
if (/^  \/internal\/tv\//m.test(publicSpec)) fail.push("Private TV monitor routes must not leak into public Backend OpenAPI");
if (!privateSpec.includes("401:") || !privateSpec.includes("503:")) fail.push("Private TV contract must document authentication and dependency failures");
if (fail.length) {
  console.error(fail.map((item) => "- " + item).join("\n"));
  process.exit(1);
}
console.log("TV monitor contract passed: Backend routes, OIDC trust boundary, migration, Flutter caller and private/public API separation agree.");
