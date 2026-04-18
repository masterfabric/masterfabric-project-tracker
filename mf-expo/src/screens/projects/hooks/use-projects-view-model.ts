import { getGraphQLErrorMessage } from '@/src/shared/helpers/graphql-error-helper';
import { useEffect, useMemo, useState } from 'react';
import { GitHubProject } from '../models/project-models';
import { useProjectsStore } from '../store/projects-store';
import { fetchMasterfabricOrgProjects, openProjectUrl, searchProjects } from '../utils';

export function useProjectsViewModel() {
  const [linkOpenErrorVisible, setLinkOpenErrorVisible] = useState(false);

  const {
    masterfabricProjects,
    isLoading,
    error,
    searchQuery,
    setMasterfabricProjects,
    setLoading,
    setError,
    setSearchQuery,
  } = useProjectsStore();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);

    try {
      const projects = await fetchMasterfabricOrgProjects();
      setMasterfabricProjects(projects);
    } catch (error) {
      setError(getGraphQLErrorMessage(error));
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = useMemo(() => {
    return searchProjects(masterfabricProjects, searchQuery);
  }, [masterfabricProjects, searchQuery]);

  const handleProjectPress = async (project: GitHubProject) => {
    try {
      await openProjectUrl(project.html_url);
    } catch (error) {
      console.error('Error opening project:', error);
      setLinkOpenErrorVisible(true);
    }
  };

  const handleRefresh = () => {
    loadProjects();
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  return {
    linkOpenErrorVisible,
    dismissLinkOpenError: () => setLinkOpenErrorVisible(false),
    projects: filteredProjects,
    masterfabricProjects,
    isLoading,
    error,
    searchQuery,
    handleProjectPress,
    handleRefresh,
    handleSearch,
  };
}
