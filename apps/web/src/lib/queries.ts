import type {
  CoverLetterSummaryDTO,
  DashboardDTO,
  DocumentDTO,
  ProfileSummaryDTO,
  ResumeDTO,
  ResumeSummaryDTO,
} from '@cv-studio/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export const qk = {
  dashboard: ['dashboard'] as const,
  resumes: (filter: string) => ['resumes', filter] as const,
  resume: (id: string) => ['resume', id] as const,
  profiles: ['profiles'] as const,
  profile: (id: string) => ['profile', id] as const,
  coverLetters: ['coverLetters'] as const,
  coverLetter: (id: string) => ['coverLetter', id] as const,
  documents: ['documents'] as const,
  aiStatus: ['aiStatus'] as const,
};

export function useDashboard() {
  return useQuery({ queryKey: qk.dashboard, queryFn: () => api.get<DashboardDTO>('/api/dashboard') });
}

export function useResumes(filter: 'active' | 'archived' | 'all' = 'active') {
  return useQuery({
    queryKey: qk.resumes(filter),
    queryFn: () => api.get<{ resumes: ResumeSummaryDTO[] }>(`/api/resumes?filter=${filter}`).then((r) => r.resumes),
  });
}

export function useResume(id: string) {
  return useQuery({
    queryKey: qk.resume(id),
    queryFn: () => api.get<{ resume: ResumeDTO }>(`/api/resumes/${id}`).then((r) => r.resume),
    // Der Editor verwaltet den Stand selbst – kein Überschreiben durch Refetch
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    gcTime: 0,
  });
}

export function useProfiles() {
  return useQuery({ queryKey: qk.profiles, queryFn: () => api.get<{ profiles: ProfileSummaryDTO[] }>('/api/profiles').then((r) => r.profiles) });
}

export function useCoverLetters() {
  return useQuery({
    queryKey: qk.coverLetters,
    queryFn: () => api.get<{ coverLetters: CoverLetterSummaryDTO[] }>('/api/cover-letters').then((r) => r.coverLetters),
  });
}

export function useDocuments() {
  return useQuery({ queryKey: qk.documents, queryFn: () => api.get<{ documents: DocumentDTO[] }>('/api/documents').then((r) => r.documents) });
}

export function useAiStatus() {
  return useQuery({
    queryKey: qk.aiStatus,
    queryFn: () => api.get<{ enabled: boolean }>('/api/ai/status').then((r) => r.enabled),
    staleTime: 10 * 60 * 1000,
  });
}
