import { create } from 'zustand';
import { RichTextTestInput, RichTextTestResult } from '../models/rich-text-helper-models';

interface RichTextHelperStore {
  testInput: RichTextTestInput;
  testResults: RichTextTestResult[];
  isLoading: boolean;
  setTestInput: (input: RichTextTestInput) => void;
  setTestResults: (results: RichTextTestResult[]) => void;
  setIsLoading: (loading: boolean) => void;
  clearResults: () => void;
}

export const useRichTextHelperStore = create<RichTextHelperStore>((set) => ({
  testInput: {
    htmlInput: '<p>Hello <b>World</b></p>',
    markdownInput: '# Heading',
    textInput:
      'Visit https://example.com @john #masterfabric or email info@test.com or call +1-555-123-4567',
  },
  testResults: [],
  isLoading: false,
  setTestInput: (input) => set({ testInput: input }),
  setTestResults: (results) => set({ testResults: results }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  clearResults: () => set({ testResults: [] }),
}));

