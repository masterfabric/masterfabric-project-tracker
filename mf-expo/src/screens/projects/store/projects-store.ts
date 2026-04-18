import { create } from 'zustand';
import { ShowcaseProject } from '../models/project-models';

interface ProjectsState {
  projects: ShowcaseProject[];
  masterfabricProjects: ShowcaseProject[];
  isLoading: boolean;
  error: string | null;
  selectedProject: ShowcaseProject | null;
  searchQuery: string;

  // Actions
  setProjects: (projects: ShowcaseProject[]) => void;
  setMasterfabricProjects: (projects: ShowcaseProject[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedProject: (project: ShowcaseProject | null) => void;
  setSearchQuery: (query: string) => void;
  reset: () => void;
}

const initialState = {
  projects: [],
  masterfabricProjects: [],
  isLoading: false,
  error: null,
  selectedProject: null,
  searchQuery: '',
};

export const useProjectsStore = create<ProjectsState>((set) => ({
  ...initialState,

  setProjects: (projects: ShowcaseProject[]) => set({ projects }),

  setMasterfabricProjects: (projects: ShowcaseProject[]) =>
    set({ masterfabricProjects: projects }),

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  setError: (error: string | null) => set({ error }),

  setSelectedProject: (project: ShowcaseProject | null) =>
    set({ selectedProject: project }),

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  reset: () => set(initialState),
}));
