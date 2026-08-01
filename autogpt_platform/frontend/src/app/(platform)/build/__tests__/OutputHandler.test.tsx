import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, cleanup } from "@testing-library/react";
import { Profiler } from "react";
import { render } from "@/tests/integrations/test-utils";
import { OutputHandler } from "../components/FlowEditor/nodes/OutputHandler";
import { useEdgeStore } from "../stores/edgeStore";
import { useNodeStore } from "../stores/nodeStore";
import { BlockUIType } from "../components/types";

vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual("@xyflow/react");
  return {
    ...actual,
    Handle: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
  };
});

beforeEach(() => {
  cleanup();
  useEdgeStore.setState({ edges: [] });
  useNodeStore.setState({
    nodes: [],
    nodesInResolutionMode: new Set(),
    nodeResolutionData: new Map(),
  });
});

describe("OutputHandler", () => {
  it("does not re-render when an unrelated node gains an edge", () => {
    const onRender = vi.fn();

    render(
      <Profiler id="output-handler" onRender={onRender}>
        <OutputHandler
          outputSchema={{
            properties: { result: { type: "string", title: "Result" } },
          }}
          nodeId="node-1"
          uiType={BlockUIType.STANDARD}
        />
      </Profiler>,
    );

    expect(onRender).toHaveBeenCalledTimes(1);

    // Connect two completely unrelated nodes. node-1's OutputHandler has no
    // stake in this change and should not re-render because of it.
    act(() => {
      useEdgeStore.getState().addEdge({
        source: "node-99",
        target: "node-100",
        sourceHandle: "output",
        targetHandle: "input",
      });
    });

    expect(onRender).toHaveBeenCalledTimes(1);
  });
});
