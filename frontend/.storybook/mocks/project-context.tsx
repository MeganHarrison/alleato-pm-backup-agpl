import React, { createContext, useContext } from "react";

const ProjectContext = createContext({
  selectedProject: { id: 67, name: "Vermillion Rise Warehouse", number: "PRJ-67", status: "active" },
  projectId: 67,
  setSelectedProject: () => {},
  isLoading: false,
  requireProject: () => true,
});

export function useProject() {
  return useContext(ProjectContext);
}

export function useOptionalProject() {
  return useContext(ProjectContext);
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  return <ProjectContext.Provider value={{
    selectedProject: { id: 67, name: "Vermillion Rise Warehouse", number: "PRJ-67", status: "active" },
    projectId: 67,
    setSelectedProject: () => {},
    isLoading: false,
    requireProject: () => true,
  }}>{children}</ProjectContext.Provider>;
}
