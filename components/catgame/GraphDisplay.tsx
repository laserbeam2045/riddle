"use client"; // Add use client directive

import React, { useEffect, useRef, useState } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });

  // SVG viewBox計算（useEffect外に移動）
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  nodes.forEach((node) => {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  });
  const paddingX = 30, paddingTop = 45, paddingBottom = 30;
  const viewBoxX = minX - paddingX;
  const viewBoxY = minY - paddingTop;
  const viewBoxWidth = maxX - minX + 2 * paddingX;
  const viewBoxHeight = maxY - minY + paddingTop + paddingBottom;

  // SVGサイズを取得
  useEffect(() => {
    if (!svgRef.current) return;
    const updateSize = () => {
      const rect = svgRef.current?.getBoundingClientRect();
      setSvgSize({ width: rect?.width || 0, height: rect?.height || 0 });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !nodes || !links) return; // Ensure nodes and links are available

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

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
      .style("fill", () => {
        // if (d.id === catNodeId) return "blue";
        // if (d.id === mouseNodeId) return "red";
        return "#bbb"; // Default node color
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
  }, [
    catNodeId,
    mouseNodeId,
    currentPlayer,
    onNodeClick,
    adj,
    nodes, // Add nodes to dependencies
    links, // Add links to dependencies
  ]);

  // ノード座標からSVGピクセル座標への変換関数（アスペクト比・余白補正対応）
  const getPixelCoords = (nodeId: string) => {
    const n = nodes.find((n) => n.id === nodeId);
    if (!n) return { x: 0, y: 0 };
    const { width: svgWidth, height: svgHeight } = svgSize;
    // スケールと余白計算
    const scale = Math.min(svgWidth / viewBoxWidth, svgHeight / viewBoxHeight);
    const offsetX = (svgWidth - viewBoxWidth * scale) / 2;
    const offsetY = (svgHeight - viewBoxHeight * scale) / 2;
    const px = offsetX + (n.x - viewBoxX) * scale;
    const py = offsetY + (n.y - viewBoxY) * scale;
    return { x: px, y: py };
  };

  // 画像サイズ
  const imgWidth = 50;
  const imgHeight = 50;
  const offsetX = 3;
  const offsetY = 25;

  // 猫・鼠の座標
  const catPos = getPixelCoords(catNodeId);
  const mousePos = getPixelCoords(mouseNodeId);

  return (
    <div
      id="game-container"
      ref={containerRef}
      className="w-full border-4 border-gray-500 bg-gray-800 p-1 relative rounded-lg shadow-lg"
      style={{ height: "400px" }}
    >
      <svg
        ref={svgRef}
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      {/* キャラクター画像をSVG上に絶対配置（アニメーション付き） */}
      {catPos && (
        <img
          src="/images/cat.png"
          alt="cat"
          width={imgWidth}
          height={imgHeight}
          style={{
            position: "absolute",
            left: catPos.x - imgWidth / 2 + offsetX,
            top: catPos.y - imgHeight + offsetY,
            transition: "left 0.4s cubic-bezier(0.22, 1, 0.36, 1), top 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        />
      )}
      {catNodeId !== mouseNodeId && mousePos && (
        <img
          src="/images/mouse.png"
          alt="mouse"
          width={imgWidth}
          height={imgHeight}
          style={{
            position: "absolute",
            left: mousePos.x - imgWidth / 2 + offsetX,
            top: mousePos.y - imgHeight + offsetY,
            transition: "left 0.4s cubic-bezier(0.22, 1, 0.36, 1), top 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};

export default GraphDisplay;
