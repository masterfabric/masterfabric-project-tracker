export interface ShowcaseProject {
  id: number;
  name: string;
  description: string | null;
  webUrl: string;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  updatedAt: string;
  topics: string[];
}

export interface ProjectsState {
  projects: ShowcaseProject[];
  isLoading: boolean;
  error: string | null;
  selectedProject: ShowcaseProject | null;
}

export interface ProjectCardProps {
  project: ShowcaseProject;
  onPress: (project: ShowcaseProject) => void;
}
