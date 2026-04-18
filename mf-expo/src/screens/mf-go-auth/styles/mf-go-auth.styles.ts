import { Sizing } from 'masterfabric-expo-core';
import { StyleSheet } from 'react-native';

export const mfGoAuthStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Sizing.padding.xl,
  },
  header: {
    marginBottom: Sizing.padding.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: Sizing.gap.s,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    opacity: 0.85,
    lineHeight: 24,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
    marginTop: Sizing.padding.s,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingLeft: Sizing.padding.l,
    paddingRight: Sizing.padding.s,
    marginBottom: Sizing.padding.m,
    minHeight: 52,
  },
  inputField: {
    flex: 1,
    paddingVertical: Sizing.padding.m,
    paddingRight: Sizing.gap.s,
    fontSize: 16,
    margin: 0,
    borderWidth: 0,
  },
  inputSuffix: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputSuffixButton: {
    padding: Sizing.padding.s,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButton: {
    paddingVertical: Sizing.padding.m,
    paddingHorizontal: Sizing.padding.xl,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: Sizing.padding.s,
  },
  submitButtonDisabled: {
    opacity: 0.72,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    marginBottom: Sizing.padding.m,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Sizing.padding.m,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: Sizing.gap.m,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabelWrap: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 15,
    lineHeight: 22,
  },
  checkboxHint: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8,
  },
  signedInCard: {
    padding: Sizing.padding.xl,
    borderRadius: 12,
    marginBottom: Sizing.padding.l,
  },
  signedInTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Sizing.gap.s,
  },
  signedInDescription: {
    fontSize: 15,
    opacity: 0.85,
    marginBottom: Sizing.padding.l,
    lineHeight: 22,
  },
  signOutButton: {
    paddingVertical: Sizing.padding.m,
    paddingHorizontal: Sizing.padding.xl,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FF3B30',
  },
  signOutButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
