import { Share2, RefreshCw, AlertTriangle } from 'lucide-react';

// Placeholder component for the Knowledge Graph Visualization
// TODO: Integrate a graph library (e.g., react-flow, vis.js, d3)
const KnowledgeGraphPanel = ({ graphData, isLoading, error, onRefresh }) => {

  const hasData = graphData && graphData.nodes && graphData.nodes.length > 0;

  return (
    <div className="knowledge-graph-panel-content h-full flex flex-col">
      {isLoading && (
        <div className="flex-grow flex items-center justify-center text-text-muted">
          <RefreshCw size={24} className="animate-spin mr-2" />
          Loading graph data...
        </div>
      )}

      {error && !isLoading && (
        <div className="flex-grow flex flex-col items-center justify-center text-red-400">
          <AlertTriangle size={32} className="mb-2" />
          <p className="text-sm mb-2">Error loading graph:</p>
          <p className="text-xs break-all mb-4">{error}</p>
           <button
             onClick={onRefresh}
             className="px-3 py-1 bg-primary/20 text-primary text-xs rounded border border-primary/30 hover:bg-primary/30"
           >
             Retry
           </button>
        </div>
      )}

      {!isLoading && !error && !hasData && (
         <div className="flex-grow flex flex-col items-center justify-center text-text-muted text-center">
            <Share2 size={32} className="mb-3" />
            <p className="text-sm">No knowledge graph data available.</p>
            <p className="text-xs mt-1">Graph will be generated from document analysis.</p>
            {/* Optionally add a button to trigger graph update */}
            {/* <button onClick={triggerUpdate} className="...">Update Graph Now</button> */}
         </div>
      )}

      {!isLoading && !error && hasData && (
        <div className="graph-container flex-grow border border-border rounded bg-dark-lighter relative overflow-hidden">
          {/* --- Visualization Placeholder --- */}
          <div className="absolute inset-0 flex items-center justify-center text-text-muted text-sm italic">
            Graph Visualization Area (Nodes: {graphData.nodes.length}, Edges: {graphData.edges.length})
          </div>
          {/* TODO: Replace above div with actual graph component using graphData */}
          {/* Example: <ReactFlow nodes={nodes} edges={edges} ... /> */}
        </div>
      )}

        {/* Refresh button */}
        {!isLoading && onRefresh && (
             <button
                 onClick={onRefresh}
                 className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-dark-light border border-border text-text-muted text-xs rounded hover:border-primary hover:text-primary transition-colors"
             >
                 <RefreshCw size={12} /> Refresh Graph
             </button>
         )}
    </div>
  );
};

export default KnowledgeGraphPanel;