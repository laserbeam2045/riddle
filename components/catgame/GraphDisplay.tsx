"use client"; // Add use client directive

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
// Import NodeData and LinkData types
import { Player, NodeData, LinkData } from "./types";
// Removed static graphData import
// Define AdjacencyList type locally or import if defined elsewhere
type AdjacencyList = { [key: string]: string[] };

interface GraphDisplayProps {
  catNodeId: string;
  mouseNodeId: string;
  currentPlayer: Player | null;
  onNodeClick: (nodeId: string) => void;
  adj: AdjacencyList;
  nodes: NodeData[]; // Add nodes prop
  links: LinkData[]; // Add links prop
}

const GraphDisplay: React.FC<GraphDisplayProps> = ({
  catNodeId,
  mouseNodeId,
  currentPlayer,
  onNodeClick,
  adj,
  nodes, // Destructure nodes prop
  links, // Destructure links prop
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  // Removed static graphData usage

  useEffect(() => {
    if (!svgRef.current || !nodes || !links) return; // Ensure nodes and links are available

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    // Calculate viewBox based on node positions with specific padding
    const paddingX = 30;
    const paddingTop = 45;
    const paddingBottom = 30;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    // Use nodes prop to calculate bounds
    nodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    });

    const viewBoxX = minX - paddingX;
    const viewBoxY = minY - paddingTop; // Use specific top padding
    const viewBoxWidth = maxX - minX + 2 * paddingX;
    const viewBoxHeight = maxY - minY + paddingTop + paddingBottom; // Use specific top/bottom padding

    // Make SVG responsive using calculated viewBox
    svg
      .attr(
        "viewBox",
        `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`
      )
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("width", "100%") // Take full width of container
      .attr("height", "100%"); // Take full height of container (optional, depends on desired aspect ratio handling)

    // --- Draw Links ---
    svg
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links) // Use links prop
      .enter()
      .append("line")
      .attr("class", "link")
      .style("stroke", "#999")
      .style("stroke-opacity", 0.6)
      // Use nodes prop to find positions
      .attr("x1", (d) => nodes.find((n) => n.id === d.source)?.x ?? 0)
      .attr("y1", (d) => nodes.find((n) => n.id === d.source)?.y ?? 0)
      .attr("x2", (d) => nodes.find((n) => n.id === d.target)?.x ?? 0)
      .attr("y2", (d) => nodes.find((n) => n.id === d.target)?.y ?? 0);

    // --- Draw Nodes ---
    const nodeSelection = svg
      .append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(nodes) // Use nodes prop
      .enter()
      .append("circle")
      .attr("class", "node")
      .attr("r", 15)
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .style("stroke", "#fff")
      .style("stroke-width", "1.5px")
      .style("cursor", "pointer") // Indicate clickable
      .on("click", (event, d) => {
        // D3 v6/v7 event handling
        onNodeClick(d.id);
      });

    // --- Apply Node Styles (Cat, Mouse, Highlight) ---
    nodeSelection
      .style("fill", (d) => {
        if (d.id === catNodeId) return "blue";
        if (d.id === mouseNodeId) return "red";
        return "#ccc"; // Default node color
      })
      .style("stroke", (d) =>
        currentPlayer === "cat" && adj[catNodeId]?.includes(d.id)
          ? "yellow"
          : "#fff"
      )
      .style("stroke-width", (d) =>
        currentPlayer === "cat" && adj[catNodeId]?.includes(d.id)
          ? "3px"
          : "1.5px"
      );

    // --- Draw Character Labels ---
    const characterLabels = svg.append("g").attr("class", "character-labels");

    // Use nodes prop to find character positions
    const catData = nodes.find((n) => n.id === catNodeId);
    const mouseData = nodes.find((n) => n.id === mouseNodeId);

    if (catData) {
      characterLabels
        .append("text")
        .attr("x", catData.x)
        .attr("y", catData.y - 20) // Position above node
        .attr("text-anchor", "middle")
        .attr("fill", "blue") // Revert fill to blue
        .attr("stroke", "white") // Add white stroke for visibility on dark bg
        .attr("stroke-width", 0.5)
        .style("pointer-events", "none")
        .style("font-weight", "bold")
        .text("cat");
    }
    // Only show mouse label if not caught
    if (mouseData && catNodeId !== mouseNodeId) {
      characterLabels
        .append("text")
        .attr("x", mouseData.x)
        .attr("y", mouseData.y - 20) // Position above node
        .attr("text-anchor", "middle")
        .attr("fill", "red") // Revert fill to red
        .attr("stroke", "white") // Add white stroke for visibility on dark bg
        .attr("stroke-width", 0.5)
        .style("pointer-events", "none")
        .style("font-weight", "bold")
        .text("mouse");
    }
  }, [
    catNodeId,
    mouseNodeId,
    currentPlayer,
    onNodeClick,
    adj,
    nodes, // Add nodes to dependencies
    links, // Add links to dependencies
  ]);

  return (
    // Adjust container for responsiveness and centering
    <div
      id="game-container"
      className="w-full border-4 border-gray-500 bg-gray-800 p-1 relative rounded-lg shadow-lg" // Removed max-w-xl, Use darker bg, rounded corners, shadow
    >
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default GraphDisplay;
