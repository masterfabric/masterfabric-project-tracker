import { ShowcaseProject } from '../models/project-models';
import showcaseData from '../data/showcase-projects.json';

export async function loadShowcaseProjects(): Promise<ShowcaseProject[]> {
  return showcaseData as ShowcaseProject[];
}

export const formatProjectDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const getLanguageColor = (language: string | null): string => {
  const colors: { [key: string]: string } = {
    TypeScript: '#3178c6',
    JavaScript: '#f1e05a',
    React: '#61dafb',
    Swift: '#fa7343',
    Kotlin: '#7f52ff',
    Java: '#b07219',
    Python: '#3572a5',
    Dart: '#00b4ab',
    HTML: '#e34c26',
    CSS: '#1572b6',
    Shell: '#89e051',
  };

  return colors[language || ''] || '#8b949e';
};

export const openProjectUrl = async (url: string): Promise<void> => {
  try {
    const Linking = require('react-native').Linking;

    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
    } else {
      throw new Error('URL cannot be opened');
    }
  } catch (error) {
    console.error('Error opening URL:', error);
    throw error instanceof Error ? error : new Error('URL cannot be opened');
  }
};

export const searchProjects = (
  projects: ShowcaseProject[],
  query: string
): ShowcaseProject[] => {
  if (!query.trim()) return projects;

  const lowercaseQuery = query.toLowerCase();
  return projects.filter(
    (project) =>
      project.name.toLowerCase().includes(lowercaseQuery) ||
      project.description?.toLowerCase().includes(lowercaseQuery) ||
      project.language?.toLowerCase().includes(lowercaseQuery) ||
      project.topics.some((topic) => topic.toLowerCase().includes(lowercaseQuery))
  );
};
