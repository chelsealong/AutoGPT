import { getGetV1GetSpecificGraphMockHandler200 } from "@/app/api/__generated__/endpoints/graphs/graphs.msw";
import { server } from "@/mocks/mock-server";
import { renderHook, waitFor } from "@/tests/integrations/test-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    useReactFlow: () => ({
      screenToFlowPosition: vi.fn(),
      fitView: vi.fn(),
    }),
  };
});

vi.mock("../hooks/useIsReadOnlyGraph", () => ({
  useIsReadOnlyGraph: () => ({ isReadOnly: false }),
}));

function makeWrapper(searchParams: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return (
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter searchParams={searchParams}>
          {children}
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );
  };
}

afterEach(() => {
  server.resetHandlers();
});

describe("useFlow: opening a saved graph without a flowVersion in the URL", () => {
  test("does not re-show the loading spinner once the flowVersion syncs into the URL", async () => {
    const { useFlow } = await import("../components/FlowEditor/Flow/useFlow");

    let sawVersionedRequest = false;
    server.use(
      getGetV1GetSpecificGraphMockHandler200(async (info) => {
        const url = new URL(info.request.url);
        if (url.searchParams.has("version")) {
          sawVersionedRequest = true;
          // Give the redundant, version-keyed refetch a real window to show
          // up in isFlowContentLoading if it regresses to a bare loading state.
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        return {
          id: "test-flow",
          name: "Test flow",
          description: "",
          version: 3,
          user_id: "owner-1",
          created_at: new Date("2026-01-01T00:00:00Z"),
          nodes: [],
          links: [],
          input_schema: {},
          output_schema: {},
          has_external_trigger: false,
          has_human_in_the_loop: false,
          has_sensitive_action: false,
          trigger_setup_info: null,
          credentials_input_schema: {},
        };
      }),
    );

    const history: boolean[] = [];
    function useFlowWithHistory() {
      const flow = useFlow();
      history.push(flow.isFlowContentLoading);
      return flow;
    }

    const { result } = renderHook(() => useFlowWithHistory(), {
      wrapper: makeWrapper("?flowID=test-flow"),
    });

    // Initial load (query key `{}`, no flowVersion yet) completes.
    await waitFor(() =>
      expect(result.current.isFlowContentLoading).toBe(false),
    );

    // useFlow syncs `flowVersion` into the URL once the graph is loaded
    // (autogpt#11585), which switches the query to a new, uncached key
    // (`{ version: 3 }`) and re-fetches the same graph. Wait for that
    // redundant fetch to actually happen and settle.
    await waitFor(() => expect(sawVersionedRequest).toBe(true));
    await waitFor(
      () => expect(result.current.isFlowContentLoading).toBe(false),
      { timeout: 2000 },
    );

    // The loading indicator must never re-appear once the graph has
    // rendered once, even though the flowVersion sync forces a second,
    // duplicate fetch for data we already have.
    const firstFalseIndex = history.indexOf(false);
    expect(firstFalseIndex).toBeGreaterThanOrEqual(0);
    expect(history.slice(firstFalseIndex)).not.toContain(true);
  });
});
