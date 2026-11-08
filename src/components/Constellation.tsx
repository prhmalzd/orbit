import { useCallback, useMemo } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap, type Edge, type Node, type NodeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Orbit, Plus } from 'lucide-react';
import { useOrbitStore } from '../store';
import { ProjectNode, type ProjectNodeData } from './ProjectNode';

const nodeTypes = { project: ProjectNode };

interface Props { onNewProject: () => void }

export function Constellation({ onNewProject }: Props) {
  const projects = useOrbitStore((state) => state.projects);
  const entries = useOrbitStore((state) => state.entries);
  const links = useOrbitStore((state) => state.links);
  const search = useOrbitStore((state) => state.search.toLowerCase());
  const moveProject = useOrbitStore((state) => state.moveProject);
  const selectProject = useOrbitStore((state) => state.selectProject);

  const visibleProjects = useMemo(() => projects.filter((project) => project.status === 'active' && (
    !search || project.title.toLowerCase().includes(search) || project.labels.some((label) => label.toLowerCase().includes(search)) ||
    entries.some((entry) => entry.projectId === project.id && entry.text.toLowerCase().includes(search))
  )), [projects, entries, search]);

  const nodes: Node<ProjectNodeData>[] = useMemo(() => visibleProjects.map((project) => ({
    id: project.id,
    type: 'project',
    position: project.position,
    data: { project, entries },
    style: { width: 310 }
  })), [visibleProjects, entries]);

  const edges: Edge[] = useMemo(() => links.filter((link) =>
    visibleProjects.some((project) => project.id === link.sourceProjectId) && visibleProjects.some((project) => project.id === link.targetProjectId)
  ).map((link) => ({
    id: link.id, source: link.sourceProjectId, target: link.targetProjectId, label: link.label,
    animated: true, style: { stroke: '#6f645c', strokeWidth: 1.5 }, labelStyle: { fill: '#b9aca2', fontSize: 11 },
    labelBgStyle: { fill: '#181613', fillOpacity: 0.88 }
  })), [links, visibleProjects]);

  const onNodesChange = useCallback((changes: NodeChange<Node<ProjectNodeData>>[]) => {
    for (const change of changes) {
      if (change.type === 'position' && change.dragging === false && change.position) {
        void moveProject(change.id, change.position.x, change.position.y);
      }
    }
  }, [moveProject]);

  if (!projects.filter((project) => project.status === 'active').length) {
    return (
      <section className="empty-orbit">
        <div className="empty-orbit__art"><Orbit size={58} /><i /><i /><i /></div>
        <div className="eyebrow">YOUR HEAD, WITH MORE ROOM</div>
        <h1>Start with one thing<br />you care about.</h1>
        <p>Projects become orbits. Every thought you capture will find its place around them.</p>
        <button className="primary-button" onClick={onNewProject}><Plus size={17} /> Create your first project</button>
      </section>
    );
  }

  return (
    <div className="constellation" aria-label="Project constellation">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => selectProject(node.id)}
        minZoom={0.3}
        maxZoom={1.8}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#39332e" gap={28} size={1.2} />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          nodeColor={(node) => (node.data as unknown as ProjectNodeData).project.color}
          maskColor="rgba(10,9,8,.72)"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}

