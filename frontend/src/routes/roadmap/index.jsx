import React, { useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export const Route = createFileRoute("/roadmap/")({
  component: () => (
    <ReactFlowProvider>
      <RouteComponent />
    </ReactFlowProvider>
  ),
});

// Custom node component with properly positioned handles
const CustomNode = ({ data }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-stone-400 w-64">
    <Handle
      type="target"
      position={Position.Top}
      className="!w-2 !h-2 !bg-teal-500 !-top-1"
    />
    <div>
      <strong>{data.topic}</strong>
      <p style={{ fontSize: "0.8em" }}>{data.description}</p>
    </div>
    <Handle
      type="source"
      position={Position.Bottom}
      className="!w-2 !h-2 !bg-teal-500 !-bottom-1"
    />
  </div>
);

const nodeTypes = {
  custom: CustomNode,
};

function RouteComponent() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlowWrapper = useRef(null);
  const reactFlowInstanceRef = useRef(null);
  const { fitView } = useReactFlow();
  const prevNodeId = useRef(null);
  const yOffset = useRef(0);

  const createNodeFromData = (data) => {
    const id = data.id.toString();
    const position = { x: 100, y: yOffset.current };
    yOffset.current += 180;
    return {
      id,
      position,
      type: "custom",
      data: {
        topic: data.topic,
        description: data.description,
      },
    };
  };

  const addNodeFromStream = useCallback(
    (data) => {
      const newNode = createNodeFromData(data);

      setNodes((nds) => [...nds, newNode]);

      // Create edge if there's a previous node
      if (prevNodeId.current) {
        const newEdge = {
          id: `edge-${prevNodeId.current}-${newNode.id}`,
          source: prevNodeId.current,
          target: newNode.id,
          animated: true,
          style: { stroke: "#1a192b", strokeWidth: 2 },
        };

        setEdges((eds) => [...eds, newEdge]);
      }

      prevNodeId.current = newNode.id;

      // Fit view after a short delay to ensure rendering
      setTimeout(() => {
        if (reactFlowInstanceRef.current) {
          reactFlowInstanceRef.current.fitView({
            padding: 0.2,
            duration: 300,
          });
        }
      }, 150);
    },
    [setNodes, setEdges]
  );

  useEffect(() => {
    const eventSource = new EventSource("http://localhost:3000/api/genRoadmap");

    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") {
        eventSource.close();
        return;
      }

      try {
        const jsonData = JSON.parse(event.data);
        addNodeFromStream(jsonData);
      } catch (err) {
        console.error("Failed to parse SSE data", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE error:", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [addNodeFromStream]);

  return (
    <div style={{ height: "100vh", width: "100%" }} ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={(instance) => {
          reactFlowInstanceRef.current = instance;
          instance.fitView({ padding: 0.1 });
        }}
        fitView
        connectionRadius={30}
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}
