import React, { useEffect, useRef } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export const Route = createFileRoute("/roadmap/")({
  component: () => (
    <ReactFlowProvider>
      <RouteComponent />
    </ReactFlowProvider>
  ),
});

function RouteComponent() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlowWrapper = useRef(null);
  const reactFlowInstanceRef = useRef(null);
  const { fitView, setViewport } = useReactFlow();

  const prevNodeId = useRef(null);
  const yOffset = useRef(0);

  const createNodeFromData = (data) => {
    const id = data.id.toString();
    const position = { x: 100, y: yOffset.current };
    yOffset.current += 180;

    return {
      id,
      position,
      data: {
        label: (
          <div>
            <strong>{data.topic}</strong>
            <p style={{ fontSize: "0.8em" }}>{data.description}</p>
          </div>
        ),
      },
    };
  };

  const addNodeFromStream = (data) => {
    const newNode = createNodeFromData(data);
    setNodes((nds) => [...nds, newNode]);

    if (prevNodeId.current) {
      setEdges((eds) =>
        addEdge(
          {
            id: `${prevNodeId.current}-${newNode.id}`,
            source: prevNodeId.current,
            target: newNode.id,
            animated: true,
            style: { stroke: "#1a192b" },
          },
          eds
        )
      );
    }

    prevNodeId.current = newNode.id;

    // Scroll to latest node
    setTimeout(() => {
      if (reactFlowInstanceRef.current) {
        const latestY = yOffset.current - 180; // Position of the last node
        reactFlowInstanceRef.current.setViewport(
          {
            x: 0,
            y: latestY - 100, // Scroll a bit above the node
            zoom: 1,
          },
          { duration: 300 }
        );
      }
    }, 100);
  };

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
  }, []);

  return (
    <div style={{ height: "100vh", width: "100%" }} ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={(instance) => {
          reactFlowInstanceRef.current = instance;
        }}
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}
